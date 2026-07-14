import { API_BASE_URL, TARGETS } from './modules/constants.js';
import { state } from './modules/state.js';
import * as UI from './modules/ui.js';
import * as Data from './modules/data_service.js';
import * as RoomManager from './modules/room_manager.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard module loaded. Version: Modular Secure Chat");

    setTimeout(() => {
        const scheduleEl = document.getElementById('today-schedule-container');
        const snapshotEl = document.getElementById('snapshot-attendance-perc');
        const userLabel = document.getElementById('sidebar-username');

        const isScheduleStuck = scheduleEl && (scheduleEl.innerText.toLowerCase().includes('loading') || scheduleEl.innerText.trim() === '');
        const isSnapshotStuck = snapshotEl && snapshotEl.innerText === '...';
        const isUserStuck = userLabel && userLabel.textContent.trim() === 'Loading...';

        if (isScheduleStuck || isSnapshotStuck || isUserStuck) {
            console.warn(">> WATCHDOG: App taking long to load. Ensure network connects.");
        }
    }, 10000); 

    let decryptedStudentList = [];
    let isDirectoryUnlocked = false;
    let credentialsLoaded = false;
    let credentialsLoading = false;

    const elements = {
        menuToggle: document.getElementById('menu-toggle'),
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        brandDashboardLink: document.getElementById('brand-dashboard-link'),
        navLinks: document.querySelectorAll('.nav-link'),
        navLinkChildren: document.querySelectorAll('.nav-link-child'),
        pageSections: document.querySelectorAll('.page-section'),
        academicsToggle: document.querySelector('[data-section="academics"]'),
        examinationsToggle: document.querySelector('[data-section="examinations"]'),
        extraToggle: document.querySelector('[data-section="extra"]'),
        myInfoToggle: document.querySelector('[data-section="my-info"]'),
        semesterSelect: document.getElementById('semester-select'),
        logoutBtn: document.getElementById('logoutBtn'),
        sidebarUsername: document.getElementById('sidebar-username'),
        sidebarRegNo: document.getElementById('sidebar-regno'),
        sidebarAvatar: document.getElementById('sidebar-avatar'),
        sidebarAvatarText: document.getElementById('sidebar-avatar-text'),
        contentContainer: document.getElementById('content'),
        btnQuickAttendance: document.getElementById('btn-quick-attendance'),
        btnQuickMarks: document.getElementById('btn-quick-marks'),

        todaySchedule: document.getElementById('today-schedule-container'),
        timetable: document.getElementById('timetable-container'),
        courses: document.getElementById('courses-container'),
        attendance: document.getElementById('attendance-container'),
        marks: document.getElementById('marks-container'),
        grades: document.getElementById('grades-container'),
        examSchedule: document.getElementById('exam-schedule-container'),
        calendar: document.getElementById('calendar-container'),
        enrollment: document.getElementById('enrollment-container'), 
        profile: document.getElementById('profile-container'),
        calculator: document.getElementById('extra-calculator'),
        credentialsStatus: document.getElementById('creds-status'),
        credentialsContent: document.getElementById('creds-content'),
        myInfoProfileContainer: document.getElementById('my-info-profile-container'),
        
        dirPassword: document.getElementById('dir-password'),
        dirTogglePassword: document.getElementById('dir-toggle-password'),
        dirSearch: document.getElementById('dir-search'),
        dirSearchBtn: document.getElementById('dir-search-btn'),
        dirResults: document.getElementById('dir-results'),
        dirLockScreen: document.getElementById('dir-lock-screen'),
        dirSearchScreen: document.getElementById('dir-search-screen'),
        dirUnlockBtn: document.getElementById('dir-unlock-btn'),
        dirLockBtn: document.getElementById('dir-lock-btn'),

        modal: document.getElementById('detail-modal'),
        modalContent: document.querySelector('.modal-content'),
        modalTitle: document.getElementById('modal-title'),
        modalBody: document.getElementById('modal-body'),
        modalCloseBtn: document.getElementById('modal-close-btn')
    };

    const allDataContainers = [
        elements.todaySchedule, elements.timetable, elements.courses,
        elements.attendance, elements.marks, elements.examSchedule, elements.grades,
        elements.calendar, elements.enrollment, elements.profile,
        elements.credentialsContent, elements.myInfoProfileContainer,
        elements.calculator
    ].filter(Boolean);

    function closeSidebar() {
        if (window.innerWidth < 768) {
            elements.sidebar.classList.add('-translate-x-full');
            if (elements.sidebarOverlay) {
                elements.sidebarOverlay.classList.remove('opacity-100');
                setTimeout(() => elements.sidebarOverlay.classList.add('hidden'), 300);
            }
        }
    }

    function openSidebar() {
        elements.sidebar.classList.remove('-translate-x-full');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove('hidden');
            setTimeout(() => elements.sidebarOverlay.classList.add('opacity-100'), 10);
        }
    }

    function updateSidebarAvatar(photoUrl) {
        if (photoUrl && elements.sidebarAvatar && elements.sidebarAvatarText) {
            elements.sidebarAvatar.src = photoUrl;
            elements.sidebarAvatar.classList.remove('hidden');
            elements.sidebarAvatarText.classList.add('hidden');
            localStorage.setItem('vtop_profile_photo', photoUrl);
        }
    }

    function showCredentialsStatus(title, message, isError = false) {
        if (!elements.credentialsStatus) return;
        const icon = isError ? 'circle-alert' : 'loader-2';
        const iconClass = isError ? 'text-red-500' : 'text-blue-500 animate-spin';
        elements.credentialsStatus.innerHTML = `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4 border border-gray-100 dark:border-gray-700">
                <i data-lucide="${icon}" class="w-8 h-8 ${iconClass}"></i>
            </div>
            <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-2">${title}</h4>
            <p class="text-gray-500 dark:text-gray-400 text-sm max-w-md">${message}</p>
        `;
        elements.credentialsStatus.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async function loadCredentials() {
        if (!elements.credentialsContent || credentialsLoading || credentialsLoaded) return;

        credentialsLoading = true;
        elements.credentialsContent.classList.add('hidden');
        showCredentialsStatus('Loading credentials', 'Fetching the account values from your active VTOP session.');

        try {
            const response = await fetch(`${API_BASE_URL}/${TARGETS.CREDENTIALS}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    session_id: localStorage.getItem('vtop_session_id')
                })
            });
            const data = await response.json();
            if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Unable to load credentials.');

            elements.credentialsContent.innerHTML = data.html_content;
            elements.credentialsContent.classList.remove('hidden');
            if (elements.credentialsStatus) elements.credentialsStatus.classList.add('hidden');
            credentialsLoaded = true;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (error) {
            showCredentialsStatus('Unable to load credentials', error.message || 'Please refresh the session and try again.', true);
        } finally {
            credentialsLoading = false;
        }
    }

    function refreshCurrentPage() {
        try {
            if (UI && typeof UI.clearAllDataContainers === 'function') {
                UI.clearAllDataContainers(allDataContainers);
            } else {
                allDataContainers.forEach(c => { if (c) c.innerHTML = ''; });
            }

            const activeNav = document.querySelector('.nav-link.active');

            if (activeNav && !['academics', 'examinations', 'extra', 'my-info'].includes(activeNav.dataset.section)) {
                const sectionId = activeNav.dataset.section;
                
                if (sectionId === 'dashboard') {
                    if (Data && typeof Data.fetchTimetableAndCourses === 'function') {
                        Data.fetchTimetableAndCourses(null, null, elements.todaySchedule)
                            .then(() => { if (typeof Data.fetchAndCalculateAttendanceSnapshot === 'function') return Data.fetchAndCalculateAttendanceSnapshot(); })
                            .then(() => { if (typeof Data.fetchAndDisplayODSnapshot === 'function') return Data.fetchAndDisplayODSnapshot(); })
                            .catch(err => console.error("Dashboard Fetch Chain Failed:", err));
                    }
                } else if (sectionId === 'enrollment' && elements.enrollment) {
                    if (Data && typeof Data.fetchAndDisplay === 'function') Data.fetchAndDisplay(TARGETS.ENROLLMENT, elements.enrollment, "Course Enrollment");
                } else if (sectionId === 'profile') {
                    if (Data && typeof Data.fetchAndDisplay === 'function') Data.fetchAndDisplay(TARGETS.PROFILE, elements.profile, "Profile");
                }
            } else {
                const activeSub = document.querySelector('.nav-link-child.active-subsection');
                if (activeSub) activeSub.click();
            }
        } catch (error) {}
    }

    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-attendance-detail');
        if (btn) {
            e.preventDefault(); e.stopPropagation();
            if (UI && typeof UI.openAttendanceDetailModal === 'function' && Data && typeof Data.fetchAttendanceDetails === 'function') {
                const { classId, slot } = UI.openAttendanceDetailModal(
                    elements.modal, elements.modalTitle, elements.modalBody,
                    elements.modalContent, btn.dataset.classId, btn.dataset.slot, btn.dataset.courseTitle
                );
                Data.fetchAttendanceDetails(classId, slot, elements.modalBody);
            }
        }
    });

    if (elements.modalCloseBtn) elements.modalCloseBtn.addEventListener('click', () => { if(UI && UI.closeModal) UI.closeModal(elements.modal, elements.modalContent, elements.modalBody); });
    if (elements.modal) elements.modal.addEventListener('click', (e) => { if (e.target === elements.modal && UI && UI.closeModal) UI.closeModal(elements.modal, elements.modalContent, elements.modalBody); });

    if (elements.btnQuickAttendance) elements.btnQuickAttendance.addEventListener('click', (e) => {
        e.preventDefault();
        const link = document.querySelector('.nav-link-child[data-subsection="academics-attendance"]');
        if (link) link.click();
    });
    if (elements.btnQuickMarks) elements.btnQuickMarks.addEventListener('click', (e) => {
        e.preventDefault();
        const link = document.querySelector('.nav-link-child[data-subsection="examinations-marks"]');
        if (link) link.click();
    });

    if (elements.brandDashboardLink) elements.brandDashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (UI && UI.showPageSection) UI.showPageSection('dashboard', elements.pageSections, elements.navLinks, elements.academicsToggle, elements.examinationsToggle, elements.extraToggle, elements.myInfoToggle);
        closeSidebar();
        elements.contentContainer.scrollTop = 0;
    });

    elements.navLinks.forEach(link => {
        if (['academics', 'examinations', 'extra', 'my-info'].includes(link.dataset.section)) return;
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            if (UI && UI.showPageSection) UI.showPageSection(link.dataset.section, elements.pageSections, elements.navLinks, elements.academicsToggle, elements.examinationsToggle, elements.extraToggle, elements.myInfoToggle);

            const section = link.dataset.section;
            if (section === 'enrollment' && elements.enrollment && Data && Data.fetchAndDisplay) Data.fetchAndDisplay(TARGETS.ENROLLMENT, elements.enrollment, "Course Enrollment");
            else if (section === 'profile' && Data && Data.fetchAndDisplay) {
                Data.fetchAndDisplay(TARGETS.PROFILE, elements.profile, "Profile");
                // Extract profile photo URL after a short delay to allow DOM to update
                setTimeout(() => {
                    const profileImg = elements.profile.querySelector('img');
                    if (profileImg && profileImg.src) {
                        updateSidebarAvatar(profileImg.src);
                    }
                }, 500);
            }
            closeSidebar();
            elements.contentContainer.scrollTop = 0;
        });
    });

    elements.navLinkChildren.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const parentId = link.dataset.parent;
            const subsectionId = link.dataset.subsection;

            if (UI && UI.showPageSection) UI.showPageSection(parentId, elements.pageSections, elements.navLinks, elements.academicsToggle, elements.examinationsToggle, elements.extraToggle, elements.myInfoToggle);
            if (UI && UI.showSubsection) UI.showSubsection(parentId, subsectionId, elements.navLinkChildren);

            if (subsectionId === 'my-info-credentials') loadCredentials();
            else if (subsectionId === 'my-info-profile') {
                if (Data && Data.fetchAndDisplay) Data.fetchAndDisplay(TARGETS.PROFILE, elements.myInfoProfileContainer, "Student Profile");
                // Extract profile photo after a short delay
                setTimeout(() => {
                    const profileImg = elements.myInfoProfileContainer.querySelector('img');
                    if (profileImg && profileImg.src) {
                        updateSidebarAvatar(profileImg.src);
                    }
                }, 500);
            }
            else if (subsectionId === 'extra-calculator') {
                elements.calculator.innerHTML = '<div class="p-8 text-center"><i data-lucide="loader" class="animate-spin h-8 w-8 mx-auto text-blue-500 mb-2"></i><p class="text-gray-500">Opening calculator...</p></div>';
                if (typeof lucide !== 'undefined') lucide.createIcons();

                Promise.all([Data.fetchAttendanceForCache(), Data.fetchTimetableForCache()]).then(() => {
                    if (window.initAttendanceCalculator) window.initAttendanceCalculator(elements.calculator, state.cachedAttendance, state.cachedTimetable);
                });
            }
            else if (subsectionId === 'academics-courses') Data.fetchTimetableAndCourses(elements.courses, null, null);
            else if (subsectionId === 'academics-timetable') Data.fetchTimetableAndCourses(null, elements.timetable, null);
            else if (subsectionId === 'academics-attendance') {
                Data.fetchAndCalculateAttendanceSnapshot()
                    .then(() => Data.fetchAndDisplay(TARGETS.ATTENDANCE, elements.attendance, "Attendance"));
            }
            else if (subsectionId === 'academics-calendar') Data.fetchAndDisplay(TARGETS.CALENDAR, elements.calendar, "Academic Calendar");
            else if (subsectionId === 'examinations-marks') Data.fetchAndDisplay(TARGETS.MARKS, elements.marks, "Marks");
            else if (subsectionId === 'examinations-grades') Data.fetchAndDisplay(TARGETS.GRADES, elements.grades, "Grades");
            else if (subsectionId === 'examinations-schedule') Data.fetchAndDisplay(TARGETS.EXAM_SCHEDULE, elements.examSchedule, "Exam Schedule");
            else if (subsectionId === 'hostel-my-room') {
                            RoomManager.populateMyRoomData();
            }
            else if (subsectionId === 'extra-directory') {
                if (!isDirectoryUnlocked) {
                    elements.dirPassword.value = '';
                    elements.dirSearch.value = '';
                    elements.dirResults.classList.add('hidden');
                    elements.dirResults.innerHTML = '';
                    if (elements.dirTogglePassword) {
                        elements.dirPassword.type = 'password';
                        elements.dirTogglePassword.innerHTML = '<i data-lucide="eye" class="h-5 w-5"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                    elements.dirLockScreen.classList.remove('hidden');
                    elements.dirSearchScreen.classList.add('hidden');
                    setTimeout(() => elements.dirPassword.focus(), 100);
                } else {
                    elements.dirLockScreen.classList.add('hidden');
                    elements.dirSearchScreen.classList.remove('hidden');
                    setTimeout(() => elements.dirSearch.focus(), 100);
                }
            }

            closeSidebar();
            elements.contentContainer.scrollTop = 0;
        });
    });

    if (elements.menuToggle) elements.menuToggle.addEventListener('click', () => { if (elements.sidebar.classList.contains('-translate-x-full')) openSidebar(); else closeSidebar(); });
    if (elements.sidebarOverlay) elements.sidebarOverlay.addEventListener('click', closeSidebar);

    const themeToggle = document.getElementById('theme-toggle');
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    if (elements.semesterSelect) {
        elements.semesterSelect.addEventListener('change', () => {
            const val = elements.semesterSelect.value;
            if(state && state.setSemesterId) state.setSemesterId(val);
            localStorage.setItem('vtop_semester_id', val);
            refreshCurrentPage();
        });
    }

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (navigator.onLine) {
                try { await fetch(`${API_BASE_URL}/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id') }) }); } catch (e) { }
            }
            localStorage.removeItem('vtop_session_id');
            window.location.href = '/login';
        });
    }

    if (elements.calendar) {
        elements.calendar.addEventListener('click', (e) => {
            const navBtn = e.target.closest('.calendar-nav-btn');
            if (navBtn && Data && Data.fetchAndDisplay) Data.fetchAndDisplay(TARGETS.CALENDAR, elements.calendar, "Academic Calendar", { calDate: navBtn.dataset.date });
        });
    }

    if (elements.dirTogglePassword) {
        elements.dirTogglePassword.addEventListener('click', () => {
            const type = elements.dirPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            elements.dirPassword.setAttribute('type', type);
            elements.dirTogglePassword.innerHTML = type === 'password' ? '<i data-lucide="eye" class="h-5 w-5"></i>' : '<i data-lucide="eye-off" class="h-5 w-5"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }

    if (elements.dirUnlockBtn) {
        elements.dirUnlockBtn.addEventListener('click', async () => {
            const password = elements.dirPassword.value;
            if (!password) { alert("Please enter the password."); return; }

            const originalBtnText = elements.dirUnlockBtn.innerHTML;
            elements.dirUnlockBtn.innerHTML = '<i data-lucide="loader" class="animate-spin w-4 h-4 mr-2"></i> Unlocking & Syncing...';
            elements.dirUnlockBtn.disabled = true;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                const key = CryptoJS.SHA256(password);
                const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js');
                const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js');

                const firebaseConfig = {
                    apiKey: "AIzaSyBsdpGsNO3y6a0EapBakU1cS6WC0pEoXSU",
                    authDomain: "vitc29.firebaseapp.com",
                    projectId: "vitc29",
                    storageBucket: "vitc29.firebasestorage.app",
                    messagingSenderId: "376204861458",
                    appId: "1:376204861458:web:5dc7fdaa74f2650911f8cb"
                };

                const app = initializeApp(firebaseConfig);
                const db = getFirestore(app);

                let querySnapshot = await getDocs(collection(db, "encrypted_students"));
                decryptedStudentList = [];
                let successCount = 0;

                querySnapshot.forEach((doc) => {
                    try {
                        const data = doc.data();
                        const decrypted = CryptoJS.AES.decrypt(data.blob, key, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
                        const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
                        if (jsonString && jsonString.startsWith('{')) {
                            const student = JSON.parse(jsonString);
                            student._searchStr = `${student.Name} ${student.RegNo} ${student.Mail} ${student.Mobile}`.toLowerCase();
                            decryptedStudentList.push(student);
                            successCount++;
                        }
                    } catch (e) { }
                });

                if (successCount === 0) {
                    alert("Unlock Failed: Incorrect Password.");
                    elements.dirUnlockBtn.innerHTML = originalBtnText;
                    elements.dirUnlockBtn.disabled = false;
                    return;
                }

                isDirectoryUnlocked = true;
                elements.dirLockScreen.classList.add('hidden');
                elements.dirSearchScreen.classList.remove('hidden');
                elements.dirPassword.value = '';
                setTimeout(() => elements.dirSearch.focus(), 100);
            } catch (error) {
                alert(error.message || "Failed to connect database.");
                elements.dirUnlockBtn.innerHTML = originalBtnText;
                elements.dirUnlockBtn.disabled = false;
            }
        });
    }

    if (elements.dirLockBtn) {
        elements.dirLockBtn.addEventListener('click', () => {
            decryptedStudentList = [];
            isDirectoryUnlocked = false;

            elements.dirLockScreen.classList.remove('hidden');
            elements.dirSearchScreen.classList.add('hidden');
            elements.dirResults.classList.add('hidden');
            elements.dirResults.innerHTML = '';
            elements.dirUnlockBtn.innerHTML = '<i data-lucide="lock-open" class="h-4 w-4 mr-2"></i> Unlock Directory';
            elements.dirUnlockBtn.disabled = false;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }

    if (elements.dirSearch) {
        elements.dirSearch.addEventListener('input', (e) => {
            if (!isDirectoryUnlocked) return;
            const term = e.target.value.toLowerCase().trim();
            const resultsContainer = elements.dirResults;

            if (term.length < 2) {
                resultsContainer.innerHTML = '';
                resultsContainer.classList.add('hidden');
                return;
            }

            const matches = decryptedStudentList.filter(s => s._searchStr.includes(term)).slice(0, 10);
            resultsContainer.innerHTML = '';

            if (matches.length === 0) {
                resultsContainer.innerHTML = '<div class="p-3 text-gray-500 text-sm text-center">No matches found.</div>';
            } else {
                matches.forEach(student => {
                    const card = document.createElement('div');
                    card.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group';
                    card.innerHTML = `
                        <div class="flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-gray-900 dark:text-white text-base">${student.Name}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${student.RegNo}</p>
                            </div>
                            <div class="transform transition-transform duration-200 chevron-icon text-gray-400 group-hover:text-blue-500">
                                <i data-lucide="chevron-down" class="w-5 h-5"></i>
                            </div>
                        </div>
                        <div class="hidden mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm space-y-2">
                            <div class="flex items-center text-gray-700 dark:text-gray-300">
                                <i data-lucide="mail" class="w-4 h-4 mr-2 text-gray-400"></i>
                                <span>${student.Mail || 'N/A'}</span>
                            </div>
                            <div class="flex items-center text-gray-700 dark:text-gray-300">
                                <i data-lucide="phone" class="w-4 h-4 mr-2 text-gray-400"></i>
                                <span>${student.Mobile || 'N/A'}</span>
                            </div>
                        </div>
                    `;
                    card.addEventListener('click', function () {
                        const details = this.querySelector('.hidden, .block');
                        const chevron = this.querySelector('.chevron-icon');
                        if (details.classList.contains('hidden')) {
                            details.classList.remove('hidden');
                            details.classList.add('block');
                            chevron.classList.add('rotate-180');
                        } else {
                            details.classList.add('hidden');
                            details.classList.remove('block');
                            chevron.classList.remove('rotate-180');
                        }
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                    resultsContainer.appendChild(card);
                });
            }
            resultsContainer.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    }
    
    function loadCachedData() {
        const cachedName = localStorage.getItem('vtop_username_cache');
        const cachedRegNo = localStorage.getItem('vtop_regno_cache');
        const cachedPhoto = localStorage.getItem('vtop_profile_photo');

        if (elements.sidebarUsername) elements.sidebarUsername.textContent = cachedName || 'User';
        if (elements.sidebarRegNo) elements.sidebarRegNo.textContent = cachedRegNo || 'Checking Session...';
        if (cachedPhoto) updateSidebarAvatar(cachedPhoto);

        const savedSemId = localStorage.getItem('vtop_semester_id');
        if (savedSemId) {
            if(state && state.setSemesterId) state.setSemesterId(savedSemId);
            elements.semesterSelect.innerHTML = `<option value="${savedSemId}" selected>Saved Semester</option>`;
        } else {
            elements.semesterSelect.innerHTML = `<option disabled>No semester saved</option>`;
        }
        
    }

    async function checkSessionAndFetchLatest() {
        const savedSessionId = localStorage.getItem('vtop_session_id');
        
        if (!savedSessionId) { 
            window.location.href = '/login'; 
            return; 
        }

        if (!navigator.onLine) { return; }

        try {
            const response = await fetch(`${API_BASE_URL}/check-session`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ session_id: savedSessionId }) 
            });
            
            if (!response.ok) throw new Error("Session check network failed");
            const data = await response.json();
            
            if (data.status === 'success') {
                const userName = data.username || localStorage.getItem('vtop_username_cache') || 'User';
                const regStatus = 'Session Active';

                if (elements.sidebarUsername) elements.sidebarUsername.textContent = userName;
                if (elements.sidebarRegNo) elements.sidebarRegNo.textContent = regStatus;

                localStorage.setItem('vtop_username_cache', userName);
                localStorage.setItem('vtop_regno_cache', regStatus);

                await populateSemesterDropdown(true); 
            } else {
                localStorage.removeItem('vtop_session_id');
                window.location.href = '/login';
            }
        } catch (error) {
            if (elements.sidebarRegNo) elements.sidebarRegNo.textContent = 'Offline Mode';
        }
    }

    // THE FIX: If VTOP rejects the semester fetch (meaning the session is dead), forcefully log out!
    async function populateSemesterDropdown(triggerRefresh = false) {
        try {
            const response = await fetch(`${API_BASE_URL}/get-semesters`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ session_id: localStorage.getItem('vtop_session_id') }) 
            });
            
            if (!response.ok) throw new Error("SERVER_REJECTED");
            const data = await response.json();
            
            if (data.status === 'success' && data.semesters && data.semesters.length > 0) {
                elements.semesterSelect.innerHTML = '';
                const savedSemId = localStorage.getItem('vtop_semester_id');
                let selectedId = data.semesters[0].id;
                
                if (savedSemId && data.semesters.some(s => s.id === savedSemId)) {
                    selectedId = savedSemId;
                }

                data.semesters.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    if (s.id === selectedId) opt.selected = true;
                    elements.semesterSelect.appendChild(opt);
                });
                
                if(state && state.setSemesterId) state.setSemesterId(selectedId);
                localStorage.setItem('vtop_semester_id', selectedId);
            } else {
                throw new Error("SERVER_REJECTED");
            }
        } catch (error) {
            if (error.message.includes("SERVER_REJECTED")) {
                console.warn("VTOP session dead. Forcing relogin.");
                localStorage.removeItem('vtop_session_id');
                window.location.href = '/login';
                return; // Prevent further refreshing
            }
        } finally {
            if (triggerRefresh && localStorage.getItem('vtop_session_id')) {
                refreshCurrentPage();
            }
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (UI && UI.showPageSection) UI.showPageSection('dashboard', elements.pageSections, elements.navLinks, elements.academicsToggle, elements.examinationsToggle, elements.extraToggle, elements.myInfoToggle);
    
    loadCachedData();
    checkSessionAndFetchLatest();
});
