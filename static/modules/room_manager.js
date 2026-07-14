// Centralized internal API fetcher
async function fetchApiData(target) {
    const sessionId = localStorage.getItem('vtop_session_id');
    const semId = localStorage.getItem('vtop_semester_id');
    const cacheKey = `vtop_cache_${target}_${semId || 'default'}_${sessionId}`;
    
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch(e) {}
    }
    
    if (!navigator.onLine) throw new Error("Offline");
    
    const payload = { session_id: sessionId, target: target, semesterSubId: semId };
    
    if (target === 'academics/common/StudentTimeTableChn') {
        payload.isSaturday = new Date().getDay() === 6;
    }
    
    const res = await fetch(`${window.location.origin}/fetch-data`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data.status === 'success') {
        localStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }
    throw new Error(data.message || "API Error");
}

export async function populateMyRoomData() {
    document.getElementById('ui-room-no').innerHTML = '<i class="animate-spin" data-lucide="loader"></i>';
    document.getElementById('ui-room-block').innerHTML = '<i class="animate-spin" data-lucide="loader"></i>';
    document.getElementById('ui-room-type').innerHTML = '<i class="animate-spin" data-lucide="loader"></i>';
    document.getElementById('ui-room-mess').innerHTML = '<i class="animate-spin" data-lucide="loader"></i>';
    document.getElementById('roommates-container').innerHTML = '<div class="p-4 text-sm text-gray-500 flex items-center"><i class="animate-spin mr-2" data-lucide="loader"></i> Syncing room data...</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const [profileData, timetableData] = await Promise.all([
            fetchApiData('student/studentProfileView'),
            fetchApiData('academics/common/StudentTimeTableChn')
        ]);

        // ==========================================
        // 1. PARSE PROFILE HTML & GET REG NO
        // ==========================================
        let block = "N/A", roomNo = "N/A", type = "N/A", mess = "N/A", myName = "You", phoneNo = "N/A";
        
        // 🔥 PERFECT FIX: Get Registration Number directly from the Login session!
        let regNo = localStorage.getItem('vtop_username_cache') || "UNKNOWN";
        regNo = regNo.trim().toUpperCase();

        if (profileData && profileData.html_content) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(profileData.html_content, 'text/html');
            
            // Get Name
            const nameEl = doc.querySelector('h3.text-xl.font-bold');
            if (nameEl) myName = nameEl.textContent.trim();

            // Get Hostel Info
            const spans = doc.querySelectorAll('span');
            spans.forEach(span => {
                const text = span.textContent.trim();
                if (text === 'Block') block = span.nextElementSibling?.textContent.trim() || block;
                if (text === 'Room No') roomNo = span.nextElementSibling?.textContent.trim() || roomNo;
                if (text === 'Bed Type') type = span.nextElementSibling?.textContent.trim() || type;
                if (text === 'Mess Type') mess = span.nextElementSibling?.textContent.trim() || mess;
            });

            // Get Phone Number
            const dts = doc.querySelectorAll('dt');
            dts.forEach(dt => {
                if (dt.textContent.trim() === 'Mobile') {
                    phoneNo = dt.nextElementSibling?.textContent.trim() || phoneNo;
                }
            });
        }

        document.getElementById('ui-room-no').textContent = roomNo;
        document.getElementById('ui-room-block').textContent = block;
        document.getElementById('ui-room-type').textContent = type;
        document.getElementById('ui-room-mess').textContent = mess;

        // ==========================================
        // 2. PARSE TIMETABLE DATA (13 Precise Slots)
        // ==========================================
        const time_slots = ["08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35", "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50", "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30", "18:35 - 19:25"];
        
        const mySchedule = { 
            'MON': Array(13).fill(false), 'TUE': Array(13).fill(false), 
            'WED': Array(13).fill(false), 'THU': Array(13).fill(false), 'FRI': Array(13).fill(false) 
        };
        
        if (timetableData && timetableData.raw_data && timetableData.raw_data.timetable) {
            const ttRaw = timetableData.raw_data.timetable;
            ['MON', 'TUE', 'WED', 'THU', 'FRI'].forEach(day => {
                if (ttRaw[day]) {
                    time_slots.forEach((slotKey, index) => {
                        const course = ttRaw[day][slotKey];
                        if (course && course.rowspan) {
                            for (let i = 0; i < course.rowspan; i++) {
                                if (index + i < 13) { mySchedule[day][index + i] = true; }
                            }
                        }
                    });
                }
            });
        }

        // ==========================================
        // 3. FIREBASE SYNC & FETCH ROOMMATES
        // ==========================================
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js');
        const { getFirestore, doc, setDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js');
        
        // Grab config securely injected from the .env file!
        const firebaseConfig = window.FIREBASE_CONFIG;
        
        const apps = getApps();
        let app = apps.find(a => a.name === "RoomManagerApp");
        if (!app) { app = initializeApp(firebaseConfig, "RoomManagerApp"); }
        const db = getFirestore(app);

        const cleanBlock = block.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanRoom = roomNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        let roommatesList = [];

        if (cleanBlock !== "NA" && cleanRoom !== "NA" && cleanBlock !== "" && cleanRoom !== "" && regNo !== "UNKNOWN") {
            console.log(`Syncing data: Block ${cleanBlock} -> Room ${cleanRoom} -> RegNo ${regNo}`);
            
            // Push My Data to Firestore 
            await setDoc(doc(db, "blocks", cleanBlock, "rooms", cleanRoom, "roommates", regNo), {
                name: myName,
                regNo: regNo,
                phone: phoneNo, 
                timetable: mySchedule,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            // Fetch Everyone's Data
            const querySnapshot = await getDocs(collection(db, "blocks", cleanBlock, "rooms", cleanRoom, "roommates"));
            querySnapshot.forEach((d) => {
                const data = d.data();
                roommatesList.push({
                    name: data.name,
                    regNo: data.regNo,
                    phone: data.phone || "N/A",
                    timetable: data.timetable,
                    isMe: data.regNo === regNo
                });
            });
        } else {
            console.warn("Missing Block, Room, or RegNo. Firebase upload skipped.");
            roommatesList.push({ name: myName, regNo: regNo, phone: phoneNo, timetable: mySchedule, isMe: true });
        }

        // ==========================================
        // 4. RENDER ROOMMATES UI
        // ==========================================
        const colors = ['bg-blue-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-blue-500'];
        let colorIdx = 1;
        roommatesList.forEach((r) => {
            if(r.isMe) r.color = colors[0];
            else { r.color = colors[colorIdx % colors.length]; colorIdx++; }
        });

        document.getElementById('roommates-container').innerHTML = roommatesList.map(r => `
            <div class="flex items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${r.isMe ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100 dark:border-gray-700'}">
                <div class="h-12 w-12 rounded-full ${r.color} text-white flex items-center justify-center font-bold text-lg mr-4 flex-shrink-0 uppercase">
                    ${r.name.charAt(0)}
                </div>
                <div class="overflow-hidden">
                    <p class="text-sm font-bold text-gray-900 dark:text-white truncate">${r.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate uppercase tracking-widest">${r.regNo}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1 truncate">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> 
                        ${r.phone}
                    </p>
                </div>
                ${r.isMe ? '<span class="ml-auto text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">ME</span>' : ''}
            </div>
        `).join('');

        // ==========================================
        // 5. RENDER TIMETABLE MATRIX
        // ==========================================
        const legendContainer = document.querySelector('.space-x-3.text-\\[10px\\]');
        if (legendContainer) {
            legendContainer.innerHTML = roommatesList.map(r => `
                <span class="flex items-center"><div class="w-3 h-3 rounded ${r.color} mr-1.5"></div> ${r.isMe ? 'You' : r.name.split(' ')[0]}</span>
            `).join('');
        }

        const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
        let ttHtml = '';
        
        days.forEach(day => {
            ttHtml += `<tr class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-3 py-2 font-bold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 sticky left-0 z-10 bg-white dark:bg-gray-800 text-xs">${day}</td>`;
            
            for(let slot=0; slot<13; slot++) {
                if (slot === 6) { // Index 6 is strictly LUNCH
                    ttHtml += `<td class="p-1 text-center align-middle border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50">
                        <svg class="w-3 h-3 text-gray-300 dark:text-gray-600 mx-auto" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                    </td>`;
                    continue;
                }

                let busyPeople = [];
                
                roommatesList.forEach(r => {
                    if (r.timetable && r.timetable[day] && r.timetable[day][slot] === true) {
                        busyPeople.push(`<div class="w-5 h-5 rounded ${r.color} text-white flex items-center justify-center text-[9px] font-bold shadow-sm" title="${r.name}">${r.name.charAt(0).toUpperCase()}</div>`);
                    }
                });
                
                ttHtml += `<td class="p-1 text-center align-middle border-r border-gray-200 dark:border-gray-700 min-w-[36px]">
                    <div class="flex flex-wrap gap-1 justify-center items-center h-full min-h-[24px]">
                        ${busyPeople.length ? busyPeople.join('') : '<span class="text-gray-200 dark:text-gray-700 text-xs">-</span>'}
                    </div>
                </td>`;
            }
            ttHtml += `</tr>`;
        });

        document.getElementById('room-timetable-body').innerHTML = ttHtml;

    } catch (error) {
        console.error("Error fetching room data:", error);
        document.getElementById('ui-room-no').textContent = "Error";
        document.getElementById('ui-room-block').textContent = "Error";
        document.getElementById('ui-room-type').textContent = "Error";
        document.getElementById('ui-room-mess').textContent = "Error";
        document.getElementById('roommates-container').innerHTML = '<div class="p-4 text-sm text-red-500">Failed to load room data. Please try again.</div>';
    }
}