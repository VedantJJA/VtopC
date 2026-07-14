export function showPageSection(sectionId, pageSections, navLinks, academicsToggle, examinationsToggle, extraToggle, myInfoToggle) {
    pageSections.forEach(section => {
        section.style.display = section.id === sectionId ? 'block' : 'none';
    });
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
    
    if (academicsToggle) academicsToggle.classList.remove('active');
    if (examinationsToggle) examinationsToggle.classList.remove('active');
    if (extraToggle) extraToggle.classList.remove('active');
    if (myInfoToggle) myInfoToggle.classList.remove('active');

    if (sectionId === 'academics' && academicsToggle) academicsToggle.classList.add('active');
    if (sectionId === 'examinations' && examinationsToggle) examinationsToggle.classList.add('active');
    if (sectionId === 'extra' && extraToggle) extraToggle.classList.add('active');
    if (sectionId === 'my-info' && myInfoToggle) myInfoToggle.classList.add('active');
}

export function showSubsection(parentId, subsectionId, navLinkChildren) {
    const parentSection = document.getElementById(parentId);
    if (!parentSection) return;
    const subsections = parentSection.querySelectorAll(`.${parentId}-subsection`);
    subsections.forEach(sub => sub.style.display = 'none');
    const targetSub = document.getElementById(subsectionId);
    if (targetSub) targetSub.style.display = 'block';
    navLinkChildren.forEach(l => l.classList.toggle('active-subsection', l.dataset.subsection === subsectionId));
}

export function clearAllDataContainers(containers) {
    containers.forEach(container => { if (container) container.innerHTML = ''; });
    
    const snapshotAttPerc = document.getElementById('snapshot-attendance-perc');
    const snapshotAttBar = document.getElementById('snapshot-attendance-bar');
    const snapshotOdCount = document.getElementById('snapshot-od-count');
    const snapshotOdBar = document.getElementById('snapshot-od-bar');
    const todayScheduleContainer = document.getElementById('today-schedule-container');
    
    // Remove any existing offline banner
    const existingBanner = document.getElementById('offline-banner');
    if (existingBanner) existingBanner.remove();

    if (snapshotAttPerc) snapshotAttPerc.textContent = '...';
    if (snapshotAttBar) snapshotAttBar.style.width = '0%';
    if (snapshotOdCount) snapshotOdCount.textContent = '...';
    if (snapshotOdBar) snapshotOdBar.style.width = '0%';
    if (todayScheduleContainer) todayScheduleContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Loading today\'s schedule...</p>';
}

export function showOfflineMessage(container) {
    const msg = document.createElement('div');
    msg.id = 'offline-banner';
    msg.className = 'mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm text-yellow-700 dark:text-yellow-300 flex items-center';
    msg.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"></path></svg>
        You are offline. Showing cached data.
    `;
    if (container) container.prepend(msg);
}

let currentTimetableData = null;
let currentDayOffset = 0;

export function navigateSchedule(direction) {
    const container = document.getElementById('today-schedule-container');
    if (!container || !currentTimetableData) return;
    populateTodaySchedule(currentTimetableData, container, currentDayOffset + direction);
}

// Make it globally available for inline onclick handlers
window.navigateSchedule = navigateSchedule;

export function populateTodaySchedule(timetableData, container, dayOffset = 0) {
    if (timetableData) currentTimetableData = timetableData;
    if (!currentTimetableData) { 
        container.innerHTML = '<p class="text-sm text-gray-500">Could not load timetable data.</p>'; 
        return; 
    }
    
    currentDayOffset = dayOffset;
    
    const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayIndex = new Date().getDay();
    let targetIndex = (todayIndex + currentDayOffset) % 7;
    if (targetIndex < 0) targetIndex += 7;
    
    const targetDayString = dayMap[targetIndex];
    
    const label = document.getElementById('schedule-day-label');
    const liveBadge = document.getElementById('schedule-live-badge');
    if (label) {
        if (currentDayOffset === 0) {
            label.textContent = "Today's Schedule";
            if (liveBadge) liveBadge.style.display = 'inline-flex';
        } else {
            if (currentDayOffset === 1) label.textContent = "Tomorrow's Schedule";
            else if (currentDayOffset === -1) label.textContent = "Yesterday's Schedule";
            else label.textContent = targetDayString + " Schedule";
            if (liveBadge) liveBadge.style.display = 'none';
        }
    }
    

    if (!currentTimetableData[targetDayString]) {
         container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 p-2">No classes scheduled.</p>';
         if (typeof lucide !== 'undefined') lucide.createIcons();
         return;
    }
    
    const todaySchedule = currentTimetableData[targetDayString];
    const time_slot_keys = ["08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35", "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50", "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30", "18:35 - 19:25"];
    let classCount = 0;
    let finalHtml = '';

    time_slot_keys.forEach((slotKey, index) => {
        if (todaySchedule && todaySchedule[slotKey] && todaySchedule[slotKey].rowspan) {
            classCount++;
            const course = todaySchedule[slotKey];
            const endTime = (time_slot_keys[index + course.rowspan - 1] || "N/A").split(' - ')[1];
            finalHtml += `<div class="flex items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"><div class="w-16 text-center border-r border-gray-200 dark:border-gray-600 pr-3"><p class="font-bold text-blue-600 dark:text-blue-400">${slotKey.split(' - ')[0]}</p><p class="text-xs text-gray-500 dark:text-gray-400">${endTime}</p></div><div class="ml-4 flex-grow"><p class="font-semibold text-gray-900 dark:text-white">${course.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${course.code} (${course.type})</p></div><span class="text-sm font-medium text-gray-700 dark:text-gray-300">${course.venue}</span></div>`;
        }
    });
    container.innerHTML = classCount === 0 ? '<p class="text-sm text-gray-500 dark:text-gray-400 p-2">No classes scheduled.</p>' : finalHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function updateAttendanceSnapshot(data) {
    const snapshotAttPerc = document.getElementById('snapshot-attendance-perc');
    const snapshotAttBar = document.getElementById('snapshot-attendance-bar');
    
    let totalAttended = 0, totalConducted = 0;
    data.forEach(course => {
        const attended = parseInt(course.attended_classes, 10);
        const total = parseInt(course.total_classes, 10);
        if (!isNaN(attended) && !isNaN(total)) { totalAttended += attended; totalConducted += total; }
    });
    let percentage = 0;
    if (totalConducted > 0) percentage = (totalAttended / totalConducted) * 100;
    if (snapshotAttPerc) {
         const p = Math.floor(percentage);
         snapshotAttPerc.textContent = `${p}%`;
         if (snapshotAttBar) {
             snapshotAttBar.style.width = `${p}%`;
         }
    }
}

export function updateODSnapshot(data) {
    const snapshotOdCount = document.getElementById('snapshot-od-count');
    const snapshotOdBar = document.getElementById('snapshot-od-bar');
    if (snapshotOdCount) {
        snapshotOdCount.textContent = `${data.total_od_count}`;
        if (snapshotOdBar) {
            const percentage = Math.min((data.total_od_count / 40) * 100, 100);
            snapshotOdBar.style.width = `${percentage}%`;
        }
    }
}

export function openAttendanceDetailModal(modal, modalTitle, modalBody, modalContent, classId, slot, courseTitle) {
    modalTitle.textContent = courseTitle || "Attendance Details";
    modalBody.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10">
            <i data-lucide="loader" class="animate-spin h-8 w-8 text-blue-500 mb-3"></i>
            <p class="text-gray-500 dark:text-gray-400">Fetching details...</p>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
    
    return { classId, slot };
}

export function closeModal(modal, modalContent, modalBody) {
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modalBody.innerHTML = '';
    }, 300);
}
