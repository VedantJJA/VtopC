from bs4 import BeautifulSoup
import json

def parse_course_data(html_content):
    """
    Parses the VTOP timetable HTML to extract registered courses and the weekly timetable
    in a more robust and accurate way. This version correctly handles colspans for labs
    and ensures accurate time slot mapping.
    """
    if not html_content:
        return {'total_credits': '0.0', 'courses': [], 'timetable': {}}
        
    soup = BeautifulSoup(html_content, "html.parser")

    # --- Part 1: Registered Courses (Made more resilient) ---
    courses = []
    total_credits = "0.0"
    course_table = soup.select_one("#getStudentDetails div.table-responsive table.table")
    
    if course_table:
        rows = course_table.find_all("tr")
        if len(rows) > 2:
            for row in rows[1:-1]:
                try:
                    cells = row.find_all("td")
                    if len(cells) < 9: continue
                    
                    course_info_ps = cells[2].find_all("p")
                    if not course_info_ps: continue
                    
                    code_title = course_info_ps[0].get_text(strip=True).split(" - ", 1)
                    if len(code_title) < 2: continue

                    course_type_text = course_info_ps[1].get_text(strip=True) if len(course_info_ps) > 1 else "Theory"

                    slot_venue_ps = cells[7].find_all("p")
                    slot = slot_venue_ps[0].get_text(strip=True).replace(' -', '') if len(slot_venue_ps) > 0 else "N/A"
                    venue = slot_venue_ps[1].get_text(strip=True) if len(slot_venue_ps) > 1 else "N/A"

                    faculty_ps = cells[8].find_all("p")
                    faculty = " ".join([p.get_text(strip=True) for p in faculty_ps if p.get_text(strip=True)])

                    courses.append({
                        "course_code": code_title[0],
                        "course_title": code_title[1],
                        "course_type": course_type_text.strip('() '),
                        "credits": cells[3].get_text(strip=True).split()[-1],
                        "faculty": faculty.replace(' - ', ' '),
                        "slot": slot,
                        "venue": venue
                    })
                except (IndexError, AttributeError):
                    continue

            total_cell = course_table.find(lambda tag: 'Total Number Of Credits' in tag.get_text())
            if total_cell and total_cell.find('b'):
                total_credits = total_cell.find('b').get_text(strip=True)

    # --- Part 2: Weekly Timetable (Major Rewrite for Accuracy and Colspan Handling) ---
    timetable_data = {day: {} for day in ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']}
    timetable_tables = soup.find_all('table', id='timeTableStyle')
    
    if len(timetable_tables) > 1:
        schedule_table = timetable_tables[1]
        all_rows = schedule_table.find_all('tr')

        # This fixed list of time slots MUST match the one in `timetable_display.html`
        # VTOP's table has 13 columns for class data (12 slots + 1 lunch)
        time_slot_keys = [
            "08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35",
            "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50",
            "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30",
            "18:35 - 19:25"
        ]
        
        current_day = ""
        for row in all_rows:
            cells = row.find_all('td')
            if not cells: continue

            # A day row is identified by having a 'rowspan' attribute.
            if 'rowspan' in cells[0].attrs:
                current_day = cells[0].get_text(strip=True)
                # In a day row, class data starts from the 3rd cell.
                data_cells = cells[2:]
            # A subsequent row for the same day (like a LAB row) starts data from the 2nd cell.
            elif cells[0].get_text(strip=True) in ["THEORY", "LAB"]:
                data_cells = cells[1:]
            else:
                continue # Skip header rows like 'Start', 'End', etc.

            if current_day not in timetable_data: continue

            col_idx = 0
            for cell in data_cells:
                if col_idx >= len(time_slot_keys): break
                
                # Correctly handle colspan for multi-hour classes (e.g., labs)
                colspan = int(cell.get('colspan', 1))
                
                text = cell.get_text(strip=True)
                if text and text != '-':
                    parts = text.split('-')
                    if len(parts) >= 4:
                        course_code = parts[1]
                        course_type_short = parts[2]
                        # Reconstruct venue name that may contain hyphens (e.g., AB1-410)
                        venue = '-'.join(parts[3:-1])

                        class_info = {
                            'code': course_code,
                            'type': course_type_short,
                            'venue': venue
                        }
                        
                        # Apply this class info to all time slots it spans
                        for i in range(colspan):
                            slot_index = col_idx + i
                            if slot_index < len(time_slot_keys):
                                slot_key = time_slot_keys[slot_index]
                                if slot_key != "LUNCH":
                                    timetable_data[current_day][slot_key] = class_info
                
                # Move the column index forward by the colspan value
                col_idx += colspan
    
    return {
        'total_credits': total_credits,
        'courses': courses,
        'timetable': timetable_data
    }

if __name__ == '__main__':
    try:
        with open('timetable_debug.html', 'r', encoding='utf-8') as f:
            html = f.read()

        parsed_data = parse_course_data(html)
        print(json.dumps(parsed_data, indent=4))
        
        with open('timetable_parsed_output.json', 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, indent=4)
            
        print("\n[SUCCESS] Successfully parsed data.")
        print("         - Parsed output saved to 'timetable_parsed_output.json'")

    except FileNotFoundError:
        print("[ERROR] timetable_debug.html not found. Make sure it's in the same directory.")
    except Exception as e:
        print(f"[ERROR] An error occurred: {e}")

