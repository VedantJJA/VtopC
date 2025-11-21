document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.location.origin;

    // --- API Targets ---
    const TIMETABLE_TARGET = 'academics/common/StudentTimeTableChn';
    const MARKS_TARGET = 'examinations/doStudentMarkView';
    const EXAM_SCHEDULE_TARGET = 'examinations/doSearchExamScheduleForStudent';
    const ATTENDANCE_TARGET = 'processViewStudentAttendance';
    const CALENDAR_TARGET = 'academics/common/CalendarPreview';
    const CURRICULUM_TARGET = 'student/viewMyCurriculum'; 
    const PROJECTS_TARGET = 'student/studentProjectView'; 
    const ENROLLMENT_TARGET = 'courseManagement/studentCourseRegister'; 
    const HOSTEL_TARGET = 'hostels/student/leave/1';
    const PROFILE_TARGET = 'student/studentProfileView';
    const GRADES_TARGET = 'examinations/examGradeView/StudentGradeView'; 

    // --- State ---
    let currentSemesterId = null;
    let cachedAttendance = []; 
    let cachedTimetable = {};  

    // --- Elements ---
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const navLinks = document.querySelectorAll('.nav-link');
    const navLinkChildren = document.querySelectorAll('.nav-link-child'); 
    const pageSections = document.querySelectorAll('.page-section');
    const academicsToggle = document.querySelector('[data-section="academics"]');
    const examinationsToggle = document.querySelector('[data-section="examinations"]');
    const extraToggle = document.querySelector('[data-section="extra"]'); 
    
    const semesterSelect = document.getElementById('semester-select');
    const logoutBtn = document.getElementById('logoutBtn');
    const sidebarUsername = document.getElementById('sidebar-username');
    const sidebarRegNo = document.getElementById('sidebar-regno');
    const contentContainer = document.getElementById('content'); 
    
    // Quick Actions
    const btnQuickAttendance = document.getElementById('btn-quick-attendance');
    const btnQuickMarks = document.getElementById('btn-quick-marks');

    // Containers
    const todayScheduleContainer = document.getElementById('today-schedule-container');
    const timetableContainer = document.getElementById('timetable-container');
    const coursesContainer = document.getElementById('courses-container');
    const attendanceContainer = document.getElementById('attendance-container');
    const marksContainer = document.getElementById('marks-container');
    const examScheduleContainer = document.getElementById('exam-schedule-container');
    const gradesContainer = document.getElementById('grades-container');
    const curriculumContainer = document.getElementById('curriculum-container');
    const projectsContainer = document.getElementById('projects-container');
    const calendarContainer = document.getElementById('calendar-container');
    const enrollmentContainer = document.getElementById('enrollment-container');
    const hostelContainer = document.getElementById('hostel-container');
    const profileContainer = document.getElementById('profile-container');
    const calculatorContainer = document.getElementById('extra-calculator'); 

    const snapshotAttPerc = document.getElementById('snapshot-attendance-perc');
    const snapshotAttBar = document.getElementById('snapshot-attendance-bar');
    const snapshotOdCount = document.getElementById('snapshot-od-count');
    const snapshotOdBar = document.getElementById('snapshot-od-bar');

    const allDataContainers = [
        todayScheduleContainer, timetableContainer, coursesContainer,
        attendanceContainer, marksContainer, examScheduleContainer, gradesContainer, curriculumContainer,
        projectsContainer, calendarContainer, enrollmentContainer,
        hostelContainer, profileContainer, calculatorContainer
    ];

    // Modal
    const modal = document.getElementById('detail-modal');
    const modalContent = modal.querySelector('.modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- Navigation ---
    function showPageSection(sectionId) {
        pageSections.forEach(section => {
            section.style.display = section.id === sectionId ? 'block' : 'none';
        });
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
        if (sectionId === 'academics' && academicsToggle) academicsToggle.classList.add('active');
        if (sectionId === 'examinations' && examinationsToggle) examinationsToggle.classList.add('active');
        if (sectionId === 'extra' && extraToggle) extraToggle.classList.add('active');
    }

    function showSubsection(parentId, subsectionId) {
        const parentSection = document.getElementById(parentId);
        if (!parentSection) return;
        const subsections = parentSection.querySelectorAll(`.${parentId}-subsection`);
        subsections.forEach(sub => sub.style.display = 'none');
        const targetSub = document.getElementById(subsectionId);
        if (targetSub) targetSub.style.display = 'block';
        navLinkChildren.forEach(l => l.classList.toggle('active-subsection', l.dataset.subsection === subsectionId));
    }

    function clearAllDataContainers() {
        allDataContainers.forEach(container => { if (container) container.innerHTML = ''; });
        if (snapshotAttPerc) snapshotAttPerc.textContent = '...';
        if (snapshotAttBar) snapshotAttBar.style.width = '0%';
        if (snapshotOdCount) snapshotOdCount.textContent = '... / 40';
        if (snapshotOdBar) snapshotOdBar.style.width = '0%';
        if (todayScheduleContainer) todayScheduleContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Loading today\'s schedule...</p>';
    }

    function refreshCurrentPage() {
        clearAllDataContainers();
        const activeNav = document.querySelector('.nav-link.active');
        if (activeNav && !['academics', 'examinations', 'extra'].includes(activeNav.dataset.section)) {
            const sectionId = activeNav.dataset.section;
            if (sectionId === 'dashboard') {
                // Only fetch if we don't have data (or just redraw from cache ideally, but re-fetching ensures sync)
                // Using sequential fetching to prevent issues
                fetchTimetableAndCourses()
                    .then(() => fetchAndCalculateAttendanceSnapshot())
                    .then(() => fetchAndDisplayODSnapshot());
            } else if (sectionId === 'enrollment') fetchAndDisplay(ENROLLMENT_TARGET, enrollmentContainer, "Course Enrollment");
            else if (sectionId === 'hostel') fetchAndDisplay(HOSTEL_TARGET, hostelContainer, "Hostel");
            else if (sectionId === 'profile') fetchAndDisplay(PROFILE_TARGET, profileContainer, "Profile");
        } else {
            const activeSub = document.querySelector('.nav-link-child.active-subsection');
            if (activeSub) {
                const subId = activeSub.dataset.subsection;
                if (subId === 'extra-calculator') {
                    if (cachedAttendance.length === 0 || Object.keys(cachedTimetable).length === 0) {
                         calculatorContainer.innerHTML = '<div class="p-8 text-center"><i data-lucide="loader" class="animate-spin h-8 w-8 mx-auto text-indigo-500 mb-2"></i><p class="text-gray-500">Fetching data for calculator...</p></div>';
                         lucide.createIcons();
                         Promise.all([fetchAttendanceForCache(), fetchTimetableForCache()]).then(() => { 
                             if(window.initAttendanceCalculator) window.initAttendanceCalculator(calculatorContainer, cachedAttendance, cachedTimetable);
                         });
                    } else { 
                        if(window.initAttendanceCalculator) window.initAttendanceCalculator(calculatorContainer, cachedAttendance, cachedTimetable);
                    }
                } else {
                     // Simulate click to reuse fetching logic
                     activeSub.click();
                }
            }
        }
    }

    // --- Data Fetching ---
    function handleFetchError(error, container) {
        console.error('Fetch error:', error);
        if (error.message.includes("Session expired")) { localStorage.removeItem('vtop_session_id'); window.location.href = '/login'; } 
        else if (container) { container.innerHTML = `<p class="text-red-500 text-sm">Error: ${error.message}</p>`; }
    }

    async function fetchAndDisplay(target, containerElement, title, extraParams = {}) {
        containerElement.innerHTML = `<p class="text-sm text-gray-500 flex items-center"><i data-lucide="loader" class="animate-spin h-5 w-5 mr-2 text-indigo-600"></i> Loading ${title || 'content'}...</p>`;
        lucide.createIcons(); 
        try {
            const currentSessionId = localStorage.getItem('vtop_session_id');
            const payload = { session_id: currentSessionId, target: target, semesterSubId: currentSemesterId, ...extraParams };
            const response = await fetch(`${API_BASE_URL}/fetch-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("Session expired.");
            const data = await response.json();
            if (data.status === 'success') { containerElement.innerHTML = data.html_content; lucide.createIcons(); } 
            else throw new Error(data.message);
        } catch (error) { handleFetchError(error, containerElement); }
    }

    async function fetchAttendanceForCache() {
        try {
            const response = await fetch(`${API_BASE_URL}/fetch-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id'), target: ATTENDANCE_TARGET, semesterSubId: currentSemesterId }) });
            const data = await response.json();
            if (data.status === 'success') cachedAttendance = data.raw_data;
        } catch (e) { console.error(e); }
    }
    
    async function fetchTimetableForCache() {
         try {
            const response = await fetch(`${API_BASE_URL}/fetch-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id'), target: TIMETABLE_TARGET, semesterSubId: currentSemesterId }) });
            const data = await response.json();
            if (data.status === 'success') cachedTimetable = data.raw_data.timetable;
         } catch (e) { console.error(e); }
    }

    async function fetchAndCalculateAttendanceSnapshot() {
        if (!currentSemesterId) return; 
        try {
            const response = await fetch(`${API_BASE_URL}/fetch-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id'), target: ATTENDANCE_TARGET, semesterSubId: currentSemesterId }) });
            const data = await response.json();
            if (data.status === 'success' && data.raw_data) {
                cachedAttendance = data.raw_data; 
                let totalAttended = 0, totalConducted = 0;
                data.raw_data.forEach(course => {
                    const attended = parseInt(course.attended_classes, 10);
                    const total = parseInt(course.total_classes, 10);
                    if (!isNaN(attended) && !isNaN(total)) { totalAttended += attended; totalConducted += total; }
                });
                let percentage = 0;
                if (totalConducted > 0) percentage = (totalAttended / totalConducted) * 100;
                if (snapshotAttPerc) {
                     const p = (Math.floor(percentage * 100) / 100).toFixed(0); 
                     snapshotAttPerc.textContent = `${p}%`;
                     snapshotAttBar.style.width = `${p}%`;
                }
            }
        } catch (error) { console.error(error); if (snapshotAttPerc) snapshotAttPerc.textContent = 'Err'; }
    }

    async function fetchTimetableAndCourses() {
        if (!currentSemesterId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/fetch-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id'), target: TIMETABLE_TARGET, semesterSubId: currentSemesterId }) });
            const data = await response.json();
            if (data.status === 'success') {
                cachedTimetable = data.raw_data.timetable;
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.html_content, 'text/html');
                const coursesContent = doc.getElementById('registered-courses-content');
                const timetableContent = doc.getElementById('weekly-timetable-content');
                if (coursesContainer) { coursesContainer.innerHTML = ''; if (coursesContent) coursesContainer.appendChild(coursesContent); }
                if (timetableContainer) { timetableContainer.innerHTML = ''; if (timetableContent) timetableContainer.appendChild(timetableContent); }
                populateTodaySchedule(data.raw_data.timetable);
                lucide.createIcons(); 
            } else throw new Error(data.message);
        } catch (error) { handleFetchError(error, timetableContainer); }
    }
    
    // Fixed populateTodaySchedule
    function populateTodaySchedule(timetableData) {
        if (!timetableData) { todayScheduleContainer.innerHTML = '<p class="text-sm text-gray-500">Could not load timetable data.</p>'; return; }
        const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const todayDayString = dayMap[new Date().getDay()];
        
        if (!timetableData[todayDayString]) {
             todayScheduleContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 p-2">No classes scheduled for today.</p>';
             return;
        }
        
        const todaySchedule = timetableData[todayDayString];
        const time_slot_keys = ["08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35", "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50", "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30", "18:35 - 19:25"];
        let classCount = 0;
        let finalHtml = '';

        time_slot_keys.forEach((slotKey, index) => {
            if (todaySchedule && todaySchedule[slotKey] && todaySchedule[slotKey].rowspan) {
                classCount++;
                const course = todaySchedule[slotKey];
                const endTime = (time_slot_keys[index + course.rowspan - 1] || "N/A").split(' - ')[1];
                finalHtml += `<div class="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"><div class="w-16 text-center border-r border-gray-200 dark:border-gray-600 pr-3"><p class="font-bold text-indigo-600 dark:text-indigo-400">${slotKey.split(' - ')[0]}</p><p class="text-xs text-gray-500 dark:text-gray-400">${endTime}</p></div><div class="ml-4 flex-grow"><p class="font-semibold text-gray-900 dark:text-white">${course.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${course.code} (${course.type})</p></div><span class="text-sm font-medium text-gray-700 dark:text-gray-300">${course.venue}</span></div>`;
            }
        });
        todayScheduleContainer.innerHTML = classCount === 0 ? '<p class="text-sm text-gray-500 dark:text-gray-400 p-2">No classes scheduled for today.</p>' : finalHtml;
    }

    async function fetchAndDisplayODSnapshot() {
        if (!currentSemesterId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/get-od-snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id'), semesterSubId: currentSemesterId }) });
            const data = await response.json();
            if (data.status === 'success' && snapshotOdCount) {
                snapshotOdCount.textContent = `${data.total_od_count} / 40`;
                snapshotOdBar.style.width = `${Math.min((data.total_od_count / 40) * 100, 100)}%`;
            }
        } catch (e) { console.error(e); }
    }

    // --- Event Listeners ---
    if (btnQuickAttendance) btnQuickAttendance.addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.nav-link-child[data-subsection="academics-attendance"]').click(); });
    if (btnQuickMarks) btnQuickMarks.addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.nav-link-child[data-subsection="examinations-marks"]').click(); });

    navLinks.forEach(link => {
        if (link === academicsToggle || link === examinationsToggle || link === extraToggle) return;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPageSection(link.dataset.section);
            const section = link.dataset.section;
            // IMPORTANT: Removed automatic refresh for 'dashboard' to prevent re-fetching
            if (section === 'enrollment') fetchAndDisplay(ENROLLMENT_TARGET, enrollmentContainer, "Course Enrollment");
            else if (section === 'hostel') fetchAndDisplay(HOSTEL_TARGET, hostelContainer, "Hostel");
            else if (section === 'profile') fetchAndDisplay(PROFILE_TARGET, profileContainer, "Profile");
            if (window.innerWidth < 768) sidebar.classList.add('-translate-x-full');
            contentContainer.scrollTop = 0;
        });
    });

    navLinkChildren.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const parentId = link.dataset.parent;
            const subsectionId = link.dataset.subsection;
            showPageSection(parentId);
            showSubsection(parentId, subsectionId);
            
            if (subsectionId === 'extra-calculator') {
                if (cachedAttendance.length === 0 || Object.keys(cachedTimetable).length === 0) {
                     calculatorContainer.innerHTML = '<div class="p-8 text-center"><i data-lucide="loader" class="animate-spin h-8 w-8 mx-auto text-indigo-500 mb-2"></i><p class="text-gray-500">Fetching data for calculator...</p></div>';
                     lucide.createIcons();
                     Promise.all([fetchAttendanceForCache(), fetchTimetableForCache()]).then(() => { 
                         if(window.initAttendanceCalculator) window.initAttendanceCalculator(calculatorContainer, cachedAttendance, cachedTimetable);
                     });
                } else { if(window.initAttendanceCalculator) window.initAttendanceCalculator(calculatorContainer, cachedAttendance, cachedTimetable); }
            }
            else if (subsectionId === 'academics-attendance') fetchAndDisplay(ATTENDANCE_TARGET, attendanceContainer, "Attendance");
            else if (subsectionId === 'academics-calendar') fetchAndDisplay(CALENDAR_TARGET, calendarContainer, "Academic Calendar");
            else if (subsectionId === 'academics-curriculum') fetchAndDisplay(CURRICULUM_TARGET, curriculumContainer, "My Curriculum");
            else if (subsectionId === 'academics-projects') fetchAndDisplay(PROJECTS_TARGET, projectsContainer, "Projects");
            else if (subsectionId === 'examinations-marks') fetchAndDisplay(MARKS_TARGET, marksContainer, "Marks");
            else if (subsectionId === 'examinations-schedule') fetchAndDisplay(EXAM_SCHEDULE_TARGET, examScheduleContainer, "Exam Schedule");

            if (window.innerWidth < 768) sidebar.classList.add('-translate-x-full');
            contentContainer.scrollTop = 0;
        });
    });
    
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'));
    const themeToggle = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
    
    semesterSelect.addEventListener('change', () => { currentSemesterId = semesterSelect.value; refreshCurrentPage(); });
    logoutBtn.addEventListener('click', async (e) => { 
        e.preventDefault();
        await fetch(`${API_BASE_URL}/logout`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({session_id: localStorage.getItem('vtop_session_id')}) }); 
        localStorage.removeItem('vtop_session_id'); window.location.href = '/login'; 
    });
    calendarContainer.addEventListener('click', (e) => {
        const navBtn = e.target.closest('.calendar-nav-btn');
        if (navBtn) fetchAndDisplay(CALENDAR_TARGET, calendarContainer, "Academic Calendar", { calDate: navBtn.dataset.date });
    });

    // --- Init ---
    async function checkSession() {
        const savedSessionId = localStorage.getItem('vtop_session_id');
        if (!savedSessionId) { window.location.href = '/login'; return; }
        try {
            const response = await fetch(`${API_BASE_URL}/check-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: savedSessionId }) });
            if (!response.ok) throw new Error();
            const data = await response.json();
            if (data.status === 'success') {
                if (sidebarUsername) sidebarUsername.textContent = data.username || 'User';
                if (sidebarRegNo) sidebarRegNo.textContent = data.username || 'Session Active';
                populateSemesterDropdown(); 
            } else { localStorage.removeItem('vtop_session_id'); window.location.href = '/login'; }
        } catch (error) { localStorage.removeItem('vtop_session_id'); window.location.href = '/login'; }
    }
    
    async function populateSemesterDropdown() {
        try {
            const response = await fetch(`${API_BASE_URL}/get-semesters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id') }) });
            const data = await response.json();
            if (data.status === 'success' && data.semesters.length > 0) {
                semesterSelect.innerHTML = ''; 
                data.semesters.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.name; semesterSelect.appendChild(opt); });
				console.log("Setting to")
				console.log(data.c_sem_id)
                currentSemesterId = data.c_sem_id;
				semesterSelect.value = data.c_sem_id;
                refreshCurrentPage();
            }
        } catch (error) { console.error(error); }
    }

    lucide.createIcons();
    showPageSection('dashboard');
    checkSession();
});