import re

from bs4 import BeautifulSoup


GRADE_LABELS = ['S', 'A', 'B', 'C', 'D', 'E', 'F']


def _cell_text(cell):
    return cell.get_text(" ", strip=True)


def _format_number(value):
    try:
        return f"{float(value):.2f}".rstrip('0').rstrip('.')
    except (TypeError, ValueError):
        return value


def _extract_course_id(row):
    trigger = row.find(attrs={'onclick': re.compile(r'getGradeViewDetails')})
    if not trigger:
        return ''

    match = re.search(r"getGradeViewDetails\(['\"]?([^'\")]+)", trigger.get('onclick', ''))
    return match.group(1).strip() if match else ''


def parse_grade_statistics(html_content):
    soup = BeautifulSoup(html_content or '', 'html.parser')

    for table in soup.find_all('table'):
        table_text = ' '.join(table.get_text(" ", strip=True).split())
        if 'Class Strength' not in table_text or 'Range of Grades' not in table_text:
            continue

        rows = []
        for tr in table.find_all('tr', recursive=False):
            cells = [_cell_text(cell) for cell in tr.find_all(['th', 'td'], recursive=False)]
            cells = [' '.join(cell.split()) for cell in cells]
            cells = [cell for cell in cells if cell]
            if cells:
                rows.append(cells)

        grade_header_index = None
        for index, row in enumerate(rows):
            if all(label in row for label in GRADE_LABELS):
                grade_header_index = index
                break

        if grade_header_index is None:
            continue

        value_row = next((row for row in rows[grade_header_index + 1:] if len(row) >= 4), [])
        if not value_row:
            continue

        stats = {
            'class_strength': value_row[0] if len(value_row) > 0 else '',
            'grading_strength': value_row[1] if len(value_row) > 1 else '',
            'mean': _format_number(value_row[2]) if len(value_row) > 2 else '',
            'sd': _format_number(value_row[3]) if len(value_row) > 3 else ''
        }

        grade_values = value_row[4:4 + len(GRADE_LABELS)]
        ranges = [
            {'grade': grade, 'range': grade_values[index] if index < len(grade_values) else ''}
            for index, grade in enumerate(GRADE_LABELS)
        ]

        note = ''
        for row in rows[grade_header_index + 2:]:
            text = ' '.join(row)
            if 'policy' in text.lower():
                note = text
                break

        return {
            'stats': stats,
            'ranges': ranges,
            'note': note
        }

    return None


def parse_grades(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')

    data = {
        'semesters': [],
        'grades': [],
        'gpa': None
    }

    # 1. Parse Semesters Dropdown
    semester_select = soup.find('select', id='semesterSubId')
    if semester_select:
        for option in semester_select.find_all('option'):
            val = option.get('value')
            if val:
                data['semesters'].append({
                    'id': val,
                    'name': option.text.strip(),
                    'selected': option.has_attr('selected')
                })

    # 2. Parse Grades Table
    table = soup.find('table', class_='table-hover')
    if table:
        rows = table.find_all('tr')
        for row in rows:
            cols = row.find_all('td')

            # Standard course row (Checking for at least 11 columns)
            if len(cols) >= 11:
                data['grades'].append({
                    'sl_no': cols[0].text.strip(),
                    'code': cols[1].text.strip(),
                    'title': cols[2].text.strip(),
                    'type': cols[3].text.strip(),
                    'l': cols[4].text.strip(),
                    'p': cols[5].text.strip(),
                    'j': cols[6].text.strip(),
                    'credits': cols[7].text.strip(), # 'C' (Credits) is the 8th column
                    'grading_type': cols[8].text.strip(),
                    'total': cols[9].text.strip(),
                    'grade': cols[10].text.strip(),
                    'course_id': _extract_course_id(row),
                    'grade_statistics': None
                })

            # GPA row at the bottom (has colspan="14" so it reads as 1 column in BeautifulSoup)
            elif len(cols) == 1 and 'GPA' in cols[0].text:
                span = cols[0].find('span')
                if span:
                    # Extracts "8.67" from "GPA : 8.67"
                    gpa_text = span.text.strip()
                    if ':' in gpa_text:
                        data['gpa'] = gpa_text.split(':')[1].strip()

    return data
