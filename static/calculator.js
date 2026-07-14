window.initAttendanceCalculator = function(containerElement, cachedAttendance, cachedTimetable) {
    containerElement.innerHTML = `
    <div class="max-w-4xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 text-gray-800 dark:text-white border-b-4 border-blue-500 inline-block pb-2">Attendance Calculator</h2>
        
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="flex border-b border-gray-200 dark:border-gray-700">
                <button id="calc-tab-subject" class="flex-1 py-4 text-sm font-medium text-center text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 transition-colors">Subject Wise</button>
                <button id="calc-tab-days" class="flex-1 py-4 text-sm font-medium text-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">Days / Dates</button>
            </div>

            <div id="calc-view-subject" class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Subject</label>
                        <select id="calc-subject-select" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"></select>
                    </div>
                    <div class="flex gap-4">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attend Next (Sessions)</label>
                            <input type="number" id="calc-attend" value="0" min="0" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Miss Next (Sessions)</label>
                            <input type="number" id="calc-miss" value="0" min="0" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                </div>
                <div id="calc-subject-result" class="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg hidden border border-gray-100 dark:border-gray-700"></div>
            </div>

            <div id="calc-view-days" class="p-6 hidden">
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                        <input type="date" id="calc-start-date" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                        <input type="date" id="calc-end-date" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status for these days</label>
                        <select id="calc-day-status" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="present">Attend All</option>
                            <option value="absent">Miss All</option>
                        </select>
                    </div>
                     <div class="flex items-end">
                        <button id="calc-days-btn" class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm">Calculate Prediction</button>
                    </div>
                 </div>
                 <div id="calc-days-result" class="mt-6 hidden space-y-3"></div>
            </div>
        </div>
    </div>`;

    const subjectSelect = document.getElementById('calc-subject-select');
    cachedAttendance.forEach((course, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${course.course_code} - ${course.course_title}`;
        subjectSelect.appendChild(option);
    });

    const tabSubject = document.getElementById('calc-tab-subject');
    const tabDays = document.getElementById('calc-tab-days');
    const viewSubject = document.getElementById('calc-view-subject');
    const viewDays = document.getElementById('calc-view-days');

    function switchTab(isSubject) {
        if (isSubject) {
            viewSubject.classList.remove('hidden'); viewDays.classList.add('hidden');
            tabSubject.classList.add('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50', 'dark:bg-blue-900/20', 'dark:text-blue-400');
            tabSubject.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
            tabDays.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50', 'dark:bg-blue-900/20', 'dark:text-blue-400');
            tabDays.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
        } else {
            viewDays.classList.remove('hidden'); viewSubject.classList.add('hidden');
            tabDays.classList.add('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50', 'dark:bg-blue-900/20', 'dark:text-blue-400');
            tabDays.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
            tabSubject.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600', 'bg-blue-50', 'dark:bg-blue-900/20', 'dark:text-blue-400');
            tabSubject.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
        }
    }
    tabSubject.addEventListener('click', () => switchTab(true));
    tabDays.addEventListener('click', () => switchTab(false));

    // Subject Logic
    function updateSubjectCalc() {
        const idx = subjectSelect.value;
        let attendInput = parseInt(document.getElementById('calc-attend').value) || 0;
        let missInput = parseInt(document.getElementById('calc-miss').value) || 0;
        
        if (cachedAttendance[idx]) {
            const course = cachedAttendance[idx];
            let multiplier = 1;
            let badge = '';
            
            if (course.course_type && course.course_type.toUpperCase().includes('LAB')) {
                multiplier = 2;
                badge = '<span class="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-normal">Lab (x2)</span>';
            }

            const attend = attendInput * multiplier;
            const miss = missInput * multiplier;

            const currentAttended = parseInt(course.attended_classes);
            const currentTotal = parseInt(course.total_classes);
            
            const newAttended = currentAttended + attend;
            const newTotal = currentTotal + attend + miss;
            const newPerc = (Math.floor((newAttended / newTotal * 100) * 100) / 100).toFixed(2);
            
            const resultDiv = document.getElementById('calc-subject-result');
            resultDiv.classList.remove('hidden');
            
            let colorClass = newPerc >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            resultDiv.innerHTML = `
                <div class="flex flex-col sm:flex-row justify-between items-center gap-2">
                    <span class="text-sm text-gray-600 dark:text-gray-300">Current: <strong>${course.percentage}</strong> (${course.attended_classes}/${course.total_classes})</span>
                    <div class="flex items-center">
                        <span class="text-lg font-bold ${colorClass}">Prediction: ${newPerc}% <span class="text-xs text-gray-500 font-normal">(${newAttended}/${newTotal})</span></span>
                        ${badge}
                    </div>
                </div>
            `;
        }
    }
    
    document.getElementById('calc-attend').addEventListener('input', updateSubjectCalc);
    document.getElementById('calc-miss').addEventListener('input', updateSubjectCalc);
    subjectSelect.addEventListener('change', updateSubjectCalc);

    // Days Logic
    document.getElementById('calc-days-btn').addEventListener('click', () => {
        const startDateVal = document.getElementById('calc-start-date').value;
        const endDateVal = document.getElementById('calc-end-date').value;
        const status = document.getElementById('calc-day-status').value;
        
        if (!startDateVal || !endDateVal) { alert("Please select dates."); return; }
        
        const start = new Date(startDateVal);
        const end = new Date(endDateVal);
        
        let tempAttendance = JSON.parse(JSON.stringify(cachedAttendance));
        const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayName = dayMap[d.getDay()];
            if (cachedTimetable[dayName]) {
                const daySchedule = cachedTimetable[dayName];
                const coursesInDay = new Set();
                Object.values(daySchedule).forEach(slot => { if (slot.code) coursesInDay.add(slot.code); });
                
                coursesInDay.forEach(code => {
                    const courseIdx = tempAttendance.findIndex(c => c.course_code === code);
                    if (courseIdx !== -1) {
                         let classesInDay = 0;
                         Object.values(daySchedule).forEach(s => { if(s.code === code) classesInDay++; });
                         
                         // Force Lab to 2 slots minimum if identified as Lab
                         if (tempAttendance[courseIdx].course_type.toUpperCase().includes('LAB') && classesInDay < 2) {
                             classesInDay = 2;
                         }

                         tempAttendance[courseIdx].total_classes = parseInt(tempAttendance[courseIdx].total_classes) + classesInDay;
                         if (status === 'present') {
                             tempAttendance[courseIdx].attended_classes = parseInt(tempAttendance[courseIdx].attended_classes) + classesInDay;
                         }
                    }
                });
            }
        }
        
        const resDiv = document.getElementById('calc-days-result');
        resDiv.innerHTML = '';
        resDiv.classList.remove('hidden');
        
        tempAttendance.forEach(course => {
            const original = cachedAttendance.find(c => c.course_code === course.course_code);
            if (original && original.total_classes != course.total_classes) {
                const newPerc = (Math.floor((course.attended_classes / course.total_classes * 100) * 100) / 100).toFixed(2);
                const colorClass = newPerc >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                
                // Rounded down original for consistency
                const originalPercRounded = (Math.floor(parseFloat(original.percentage) * 100) / 100).toFixed(2) + "%";

                resDiv.innerHTML += `
                    <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                        <div>
                            <p class="font-bold text-sm dark:text-white mb-0.5">${course.course_code}</p>
                            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span>${originalPercRounded}</span>
                                <i data-lucide="arrow-right" class="w-3 h-3"></i>
                                <span class="${colorClass} font-bold text-sm">${newPerc}%</span>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400 font-mono">
                            ${course.attended_classes}/${course.total_classes}
                        </div>
                    </div>
                `;
            }
        });
        if (resDiv.innerHTML === '') resDiv.innerHTML = '<p class="text-sm text-gray-500 text-center italic">No classes found in schedule for these dates.</p>';
        lucide.createIcons();
    });
};