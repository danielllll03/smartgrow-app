let currentImageBase64 = null;
let currentImageMime = null;

window.addEventListener('DOMContentLoaded', function() {
    if(window.location.pathname.includes('login.html')) return;

    if(localStorage.getItem('sg_session_active') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    console.log("System Ready. SmartGrow Connected to Vercel Serverless AI.");
    
    loadDataToForm();
    loadDataToDashboard();
    loadChatHistory(); 
    loadUserProfileUI();

    if (document.querySelector('.menu-list')) loadMenuAI();
    if (document.querySelector('.report-container')) loadLaporanAI();
    if (document.querySelector('.malnutrisi-status')) loadMalnutrisiAI();
    if (document.querySelector('.analysis-grid')) loadAnalisisAI();
    if (document.querySelector('.calendar')) initCalendar();

    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        if(e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageSelect({ files: e.dataTransfer.files });
        }
    });
});

function loadUserProfileUI() {
    const namaOrtu = localStorage.getItem('sg_nama_ortu');
    if (namaOrtu) {
        document.querySelectorAll('.user-info h4, #profileNamaOrtu').forEach(el => {
            if(el.tagName === 'H4') el.innerText = namaOrtu;
            if(el.tagName === 'INPUT') el.value = namaOrtu;
        });
    }
}

function saveChatToStorage(sender, text, time, imageSrc = null) {
    let history = JSON.parse(localStorage.getItem('sg_chat_history')) || [];
    history.push({ sender, text, time, image: imageSrc });
    try { localStorage.setItem('sg_chat_history', JSON.stringify(history)); } catch (e) {}
}

function loadChatHistory() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    const history = JSON.parse(localStorage.getItem('sg_chat_history')) || [];
    chatMessages.innerHTML = ''; 
    if (history.length === 0) {
        chatMessages.innerHTML = `<div class="message message-bot">Halo Bunda! 👋<br>Kirim foto atau tanya seputar gizi si Kecil untuk analisis AI.<div class="message-time">System</div></div>`;
    } else {
        history.forEach(msg => renderMessageBubble(msg.sender, msg.text, msg.time, msg.image));
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderMessageBubble(sender, text, time, imageSrc = null) {
    const chatMessages = document.getElementById('chatMessages');
    if(!chatMessages) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${sender}`;
    let contentHtml = "";
    if (imageSrc) contentHtml += `<img src="${imageSrc}" style="max-width:100%; border-radius:12px; margin-bottom:8px; border:1px solid #e2e8f0;">`;
    if (text) contentHtml += `<div>${text}</div>`;
    contentHtml += `<div class="message-time">${time}</div>`;
    msgDiv.innerHTML = contentHtml;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv; 
}

function addMessageToUI(sender, text, time, imageSrc = null) {
    renderMessageBubble(sender, text, time, imageSrc);
    if (!text.includes('Menganalisis')) saveChatToStorage(sender, text, time, imageSrc);
}

function handleImageSelect(input) {
    const file = input.files ? input.files[0] : null;
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert("Wajib memilih file gambar!"); return; }
    const reader = new FileReader();
    reader.onloadend = function() {
        currentImageBase64 = reader.result.split(',')[1]; 
        currentImageMime = file.type;
        const container = document.getElementById('imagePreviewContainer');
        const img = document.getElementById('imagePreview');
        if (container && img) { img.src = reader.result; container.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    currentImageBase64 = null;
    currentImageMime = null;
    const input = document.getElementById('imageInput');
    if(input) input.value = ""; 
    const container = document.getElementById('imagePreviewContainer');
    if(container) container.style.display = 'none';
    const img = document.getElementById('imagePreview');
    if(img) img.src = "";
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const hasImage = currentImageBase64 !== null;
    const imgData = currentImageBase64; 
    const imgMime = currentImageMime;
    let imgDisplaySrc = (hasImage && imgMime && imgData) ? `data:${imgMime};base64,${imgData}` : null;

    if ((!input || input.value.trim() === '') && !hasImage) return;
    
    const message = input.value.trim();
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    addMessageToUI('user', message, time, imgDisplaySrc);
    input.value = '';
    clearImage(); 

    const loadingDiv = renderMessageBubble('bot', 'Menganalisis data... ⏳', time);

    const dataAnak = JSON.parse(localStorage.getItem('sg_data_anak_lengkap')) || {};

    try {
        // Memanggil Serverless Function di Vercel (/api/chat)
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message, 
                image: imgData, 
                mimeType: imgMime, 
                dataAnak: dataAnak 
            })
        });

        const aiData = await response.json();
        if(loadingDiv) loadingDiv.remove(); 

        if (!response.ok || aiData.error) {
            throw new Error(aiData.error || "Gagal memproses dari server AI.");
        }

        addMessageToUI('bot', aiData.chat_reply, time);

        if (aiData.analysis || aiData.menu) {
            localStorage.setItem('sg_ai_data', JSON.stringify(aiData));
            localStorage.setItem('sg_ai_last_update', new Date().toLocaleDateString('id-ID'));
            
            if (typeof loadLaporanAI === 'function') loadLaporanAI();
            if (typeof loadMenuAI === 'function') loadMenuAI();
            if (typeof loadAnalisisAI === 'function') loadAnalisisAI();
            if (typeof loadMalnutrisiAI === 'function') loadMalnutrisiAI();
        }

    } catch (error) {
        if(loadingDiv) loadingDiv.remove();
        addMessageToUI('bot', 'Maaf Bunda, gagal memproses respons AI. Pastikan jaringan internet stabil dan coba lagi ya.', time);
        console.error("AI Error:", error);
    }
}

function handleSaveData(e){
    e.preventDefault();
    const d = {
        nama: document.getElementById('inputNama').value,
        tglLahir: document.getElementById('inputLahir').value,
        tb: document.getElementById('inputTB').value,
        bb: document.getElementById('inputBB').value
    };
    localStorage.setItem('sg_data_anak_lengkap', JSON.stringify(d));
    localStorage.setItem('sg_nama_anak', d.nama);
    alert('Data Si Kecil Berhasil Disimpan!');
    window.location.reload();
}

function loadDataToForm(){
    const d = JSON.parse(localStorage.getItem('sg_data_anak_lengkap'));
    if(d){
        document.querySelectorAll('#displayNamaAnak').forEach(el => el.innerText = "Ibu dari " + d.nama);
        document.querySelectorAll('#displayNamaAnakSub').forEach(el => el.innerText = `Ibu dari ${d.nama}`);
        if(document.getElementById('inputNama')) document.getElementById('inputNama').value = d.nama;
        if(document.getElementById('inputLahir')) document.getElementById('inputLahir').value = d.tglLahir;
        if(document.getElementById('inputTB')) document.getElementById('inputTB').value = d.tb;
        if(document.getElementById('inputBB')) document.getElementById('inputBB').value = d.bb;
    }
}

function loadDataToDashboard(){
    const d = JSON.parse(localStorage.getItem('sg_data_anak_lengkap'));
    if(!d) return;
    if(document.getElementById('dashTB')) document.getElementById('dashTB').innerText = d.tb + " cm";
    if(document.getElementById('dashBB')) document.getElementById('dashBB').innerText = d.bb + " kg";
    if(document.getElementById('dashUmur') && d.tglLahir){
        const t = new Date(), b = new Date(d.tglLahir);
        let y = t.getFullYear() - b.getFullYear(), m = t.getMonth() - b.getMonth();
        if(m < 0){ y--; m += 12; }
        document.getElementById('dashUmur').innerText = `${y} Thn ${m} Bln`;
    }
}

function loadAnalisisAI() {
    const data = JSON.parse(localStorage.getItem('sg_ai_data'));
    if (!data || !data.analysis) return;
    const update = (id, info) => {
        const badge = document.getElementById(id+'-badge');
        const desc = document.getElementById(id+'-desc');
        if(badge && desc && info) {
            badge.innerText = info.status || "Menunggu Data";
            desc.innerText = info.desc || "Belum ada analisis.";
            const statusLower = (info.status||"").toLowerCase();
            badge.className = statusLower.match(/kurang|buruk|pasif|waspada|perhatian/) ? "status-badge warning" : "status-badge normal";
        }
    };
    const a = data.analysis;
    update('gizi', a?.gizi); 
    update('vitamin', a?.vitamin); 
    update('tidur', a?.tidur); 
    update('fisik', a?.fisik);
}

function loadMenuAI() {
    const data = JSON.parse(localStorage.getItem('sg_ai_data'));
    const list = document.querySelector('.menu-list');
    if (!data || !data.menu || !list) return;
    list.innerHTML = '';
    data.menu.forEach(item => {
        list.innerHTML += `
            <div class="menu-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9;">
                <div>
                    <b>${item.name || item.makanan}</b>
                    <p style="margin:2px 0 0 0; font-size:0.85rem; color:#64748b;">${item.time || "Jadwal"} - ${item.nutrients || item.kandungan}</p>
                </div>
                <div style="background:#d1fae5; color:#059669; padding:4px 10px; border-radius:8px; font-weight:700; font-size:0.85rem;">${item.cal || item.kalori}</div>
            </div>`;
    });
}

function loadLaporanAI() {
    const data = JSON.parse(localStorage.getItem('sg_ai_data'));
    const cont = document.querySelector('.report-container');
    if (!data || !cont) return;
    cont.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:1.1rem; color:#0f172a;">Catatan Analisis Medis AI</h3>
                <span style="font-size:0.8rem; color:#64748b; font-weight:600;">Update: ${localStorage.getItem('sg_ai_last_update')}</span>
            </div>
            <p style="color:#334155; line-height:1.6; font-size:0.95rem; margin:0;">${data.report_summary}</p>
        </div>`;
}

function loadMalnutrisiAI() {
    const data = JSON.parse(localStorage.getItem('sg_ai_data'));
    const card = document.querySelector('.malnutrisi-card');
    if (!data || !card) return;
    const statusVal = (data.malnutrition_status || "").toLowerCase();
    const isAman = statusVal === 'aman' || statusVal === 'normal';
    
    document.getElementById('malnutrisiTitle').innerText = isAman ? "✅ Status: Aman (Gizi Seimbang)" : "⚠️ Status: Perlu Perhatian Khusus";
    card.style.borderLeft = isAman ? "6px solid #059669" : "6px solid #EF4444";
    card.style.backgroundColor = isAman ? "#f0fdf4" : "#fef2f2";
    document.getElementById('malnutrisiDesc').innerText = data.malnutrition_text;
}

let events = JSON.parse(localStorage.getItem('sg_events_realtime')) || {}, selectedDateKey = null;

function initCalendar(){
    const d = document.querySelector(".days"), c = document.querySelector(".current-date");
    if(!d || !c) return;
    let dt = new Date(), y = dt.getFullYear(), m = dt.getMonth();
    const ms = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const r = () => {
        let f = new Date(y,m,1).getDay(), l = new Date(y,m+1,0).getDate(), tg = "";
        for(let i=f; i>0; i--) tg += `<li class="inactive"></li>`;
        for(let i=1; i<=l; i++){
            let k = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`, td = new Date(), it = (i===td.getDate()&&m===td.getMonth()&&y===td.getFullYear())?"active":"", he=events[k]?"has-event":"";
            tg += `<li class="${it} ${he}" onclick="selectDate('${k}')" style="padding:10px 0; cursor:pointer;">${i}</li>`;
        }
        c.innerText = `${ms[m]} ${y}`;
        d.innerHTML = tg;
    };
    r();
    document.querySelectorAll(".icons span").forEach(n => {
        n.addEventListener("click", () => {
            m = n.id === "prev" ? m - 1 : m + 1;
            if(m < 0 || m > 11){ dt = new Date(y,m); y = dt.getFullYear(); m = dt.getMonth(); }
            r();
        });
    });
    selectDate(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`);
}

function selectDate(k){
    selectedDateKey = k;
    if(document.getElementById('selectedDateLabel')) document.getElementById('selectedDateLabel').innerText = "Jadwal: " + k;
    renderEventList();
}

function addEvent(){
    const i = document.getElementById('eventInput');
    if(!i || !i.value.trim() || !selectedDateKey) return;
    if(!events[selectedDateKey]) events[selectedDateKey] = [];
    events[selectedDateKey].push(i.value.trim());
    localStorage.setItem('sg_events_realtime', JSON.stringify(events));
    i.value = '';
    renderEventList();
    initCalendar();
}

function renderEventList(){
    const l = document.getElementById('eventList');
    if(!l) return;
    l.innerHTML = '';
    const e = events[selectedDateKey] || [];
    if(e.length === 0) l.innerHTML = '<p style="color:#94a3b8; font-size:0.9rem;">Tidak ada jadwal di tanggal ini.</p>';
    e.forEach((v,i) => l.innerHTML += `
        <div class="event-list-item">
            <span>${v}</span>
            <button class="delete-event-btn" onclick="deleteEvent(${i})">✕</button>
        </div>`);
}

function deleteEvent(i){
    events[selectedDateKey].splice(i,1);
    if(events[selectedDateKey].length === 0) delete events[selectedDateKey];
    localStorage.setItem('sg_events_realtime', JSON.stringify(events));
    renderEventList();
    initCalendar();
}

function resetApp(){
    if(confirm("Apakah Anda yakin ingin menghapus semua data anak dan riwayat chat?")){
        localStorage.clear();
        window.location.href = 'login.html';
    }
}