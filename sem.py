from datetime import datetime, date
import calendar
import json

def get_last_day(dt: date) -> date:
    _, last_day_num = calendar.monthrange(dt.year, dt.month)
    return dt.replace(day=last_day_num)

def find_semester_id(api_data: dict) -> str:

    current_date_str = datetime.now().strftime('%Y-%m-%d')
    with open('sem.json', 'r') as f:
        date_range_data = json.load(f)
    
    def parse_date_robust(date_str):
        formats = ['%B %Y', '%b %Y']
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Date string '{date_str}' is neither full nor abbreviated month format.")

    name_to_id = {}
    for item in api_data.get('semesters', []):
        short_name = item['name'].split(' ')[0]
        name_to_id[short_name] = item['id']

    try:
        current_date = datetime.strptime(current_date_str, '%Y-%m-%d').date()
    except ValueError:
        return f"Error: Could not parse date string '{current_date_str}'"

    for semester_name, month_range in date_range_data.items():
        if len(month_range) != 2:
            return f"Error: Month range for {semester_name} must contain exactly two elements."
            
        start_month_year, end_month_year = month_range[0], month_range[1]

        try:
            start_dt = parse_date_robust(start_month_year)
            
            end_dt_temp = parse_date_robust(end_month_year)
            end_date = get_last_day(end_dt_temp)
            
            if start_dt <= current_date <= end_date:
                return name_to_id.get(semester_name, "ID not found in API data")

        except ValueError as e:
            return f"Error processing date range for {semester_name}: {e}"

    return "No matching semester ID found"

if __name__ == "__main__":
    API_DATA = {'status': 'success', 'semesters': [
        {'id': 'CH20252605', 'name': 'Winter Semester 2025-26'},
        {'id': 'CH20252601', 'name': 'Fall Semester 2025-26'}
    ]}

    result = find_semester_id(API_DATA)

    print(result)