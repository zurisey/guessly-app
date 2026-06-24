let currentAdminUser = "";

document.getElementById('btnLoadQuestions').addEventListener('click', () => {
    let username = document.getElementById('adminUsername').value.trim().toLowerCase();
    if (!username) return alert("Masukkan Username!");
    
    currentAdminUser = username;
    document.getElementById('adminLoginPanel').classList.add('hidden');
    document.getElementById('adminDashboardPanel').classList.remove('hidden');
    document.getElementById('displayAdminUser').innerText = username;
    fetchQuestions();
});

async function fetchQuestions() {
    const res = await fetch(`/api/questions/${currentAdminUser}`);
    const questions = await res.json();
    const list = document.getElementById('questionList');
    list.innerHTML = "";
    
    questions.forEach((q, index) => {
        let li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>Q:</strong> ${q.q} <br>
                <strong>A:</strong> ${q.a}
            </div>
            <button class="btn-delete" onclick="deleteQuestion(${index})">Hapus</button>
        `;
        list.appendChild(li);
    });
}

// Tambah Manual
document.getElementById('btnAddQuestion').addEventListener('click', async () => {
    const q = document.getElementById('newQuestion').value.trim();
    const a = document.getElementById('newAnswer').value.trim();
    
    if (!q || !a) {
        document.getElementById('adminError').innerText = "Mohon isi semua kolom!";
        return;
    }
    
    document.getElementById('adminError').innerText = "";
    await fetch(`/api/questions/${currentAdminUser}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, a })
    });
    
    document.getElementById('newQuestion').value = "";
    document.getElementById('newAnswer').value = "";
    fetchQuestions();
});

async function deleteQuestion(index) {
    await fetch(`/api/questions/${currentAdminUser}/${index}`, { method: 'DELETE' });
    fetchQuestions();
}

// Tambah via TXT
document.getElementById('btnUploadTxt').addEventListener('click', () => {
    const fileInput = document.getElementById('fileTxt');
    if (fileInput.files.length === 0) return alert("Pilih file .txt terlebih dahulu!");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let newQuestions = [];

        lines.forEach(line => {
            if (line.includes('|')) {
                const parts = line.split('|');
                const q = parts[0].trim();
                const a = parts[1].trim();
                if (q && a) newQuestions.push({ q, a });
            }
        });

        if (newQuestions.length === 0) {
            return alert("Tidak ada soal valid ditemukan. Pastikan format: Soal | Jawaban");
        }

        await fetch(`/api/questions/bulk/${currentAdminUser}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: newQuestions })
        });

        fileInput.value = ""; 
        fetchQuestions();
        alert(`${newQuestions.length} soal berhasil diunggah!`);
    };

    reader.readAsText(file);
});