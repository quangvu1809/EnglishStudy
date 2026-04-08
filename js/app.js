// ============================================
// English Exam Practice App - Main Logic
// ============================================

// ─── STATE ─────────────────────────────────────
let currentExam = [];
let userAnswers = {};
let timerInterval = null;
let timeRemaining = 60 * 60; // 60 minutes in seconds
let examStartTime = null;
let examFinished = false;
let currentUser = null; // { uid, username, fullname, email }

// ─── CONSTANTS ─────────────────────────────────
const EXAM_DURATION = 60 * 60; // 60 minutes
const TOTAL_QUESTIONS = 40;
const SAVED_BANK_KEY = 'saved_question_bank';
// Auth handled by Firebase
const SECTION_CONFIG = {
    pronunciation: { count: 2, label: 'Pronunciation - Phát âm', badge: 'badge-phonetics', navId: 'nav-phonetics', icon: 'fa-volume-up' },
    stress:        { count: 2, label: 'Word Stress - Trọng âm', badge: 'badge-phonetics', navId: 'nav-phonetics', icon: 'fa-music' },
    grammar:       { count: 10, label: 'Vocabulary & Grammar - Từ vựng & Ngữ pháp', badge: 'badge-grammar', navId: 'nav-grammar', icon: 'fa-spell-check' },
    communication: { count: 4, label: 'Communication - Giao tiếp', badge: 'badge-communication', navId: 'nav-communication', icon: 'fa-comments' },
    notice:        { count: 4, label: 'Notices & Signs - Biển báo / Thông báo', badge: 'badge-notice', navId: 'nav-notice', icon: 'fa-sign' },
    synonym:       { count: 4, label: 'Sentence Rewriting - Câu đồng nghĩa', badge: 'badge-synonym', navId: 'nav-synonym', icon: 'fa-exchange-alt' },
    arrange:       { count: 2, label: 'Sentence Arrangement - Sắp xếp câu', badge: 'badge-arrange', navId: 'nav-arrange', icon: 'fa-sort' },
    cloze:         { count: 4, label: 'Cloze Test - Điền từ đoạn văn', badge: 'badge-cloze', navId: 'nav-cloze', icon: 'fa-file-alt' },
    reading:       { count: 8, label: 'Reading Comprehension - Đọc hiểu', badge: 'badge-reading', navId: 'nav-reading', icon: 'fa-book-reader' }
};

// ─── QUESTION BANK MANAGEMENT ──────────────────
function loadSavedBank() {
    try {
        const data = localStorage.getItem(SAVED_BANK_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {
        console.error('Error loading saved bank:', e);
    }
    return {
        pronunciation: [], stress: [], grammar: [], communication: [],
        notice: [], synonym: [], arrange: [], cloze: [], reading: []
    };
}

function saveQuestionsToBank(examQuestions) {
    const savedBank = loadSavedBank();
    const processedPassages = new Set();
    let newCount = 0;

    examQuestions.forEach(q => {
        const section = q.section;

        if (section === 'cloze' || section === 'reading') {
            if (!processedPassages.has(q.passageId)) {
                processedPassages.add(q.passageId);
                const passageQuestions = examQuestions.filter(eq => eq.passageId === q.passageId);
                // Check duplicate by comparing passage text (first 100 chars)
                const passageKey = (q.passage || '').substring(0, 100);
                const exists = savedBank[section].some(p => (p.passage || '').substring(0, 100) === passageKey);
                if (!exists) {
                    savedBank[section].push({
                        id: q.passageId || `saved_${section}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        title: q.passageTitle || '',
                        passage: q.passage,
                        questions: passageQuestions.map(pq => ({
                            id: pq.id, question: pq.question, options: pq.options,
                            correct: pq.correct, explanation: pq.explanation, tip: pq.tip
                        }))
                    });
                    newCount += passageQuestions.length;
                }
            }
        } else {
            // Check duplicate by comparing question text (first 80 chars)
            const qKey = (q.question || '').substring(0, 80);
            const allQuestions = [...(QUESTION_BANK[section] || []), ...savedBank[section]];
            const exists = allQuestions.some(sq => (sq.question || '').substring(0, 80) === qKey);
            if (!exists) {
                savedBank[section].push({
                    id: q.id || `saved_${section}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    question: q.question, options: q.options,
                    correct: q.correct, explanation: q.explanation, tip: q.tip
                });
                newCount++;
            }
        }
    });

    localStorage.setItem(SAVED_BANK_KEY, JSON.stringify(savedBank));
    return newCount;
}

function getCombinedBank() {
    const savedBank = loadSavedBank();
    const combined = {};
    const singleSections = ['pronunciation', 'stress', 'grammar', 'communication', 'notice', 'synonym', 'arrange'];

    singleSections.forEach(section => {
        combined[section] = [...(QUESTION_BANK[section] || [])];
        savedBank[section].forEach(sq => {
            const qKey = (sq.question || '').substring(0, 80);
            const exists = combined[section].some(q => (q.question || '').substring(0, 80) === qKey);
            if (!exists) combined[section].push(sq);
        });
    });

    ['cloze', 'reading'].forEach(section => {
        combined[section] = [...(QUESTION_BANK[section] || [])];
        savedBank[section].forEach(sp => {
            const pKey = (sp.passage || '').substring(0, 100);
            const exists = combined[section].some(p => (p.passage || '').substring(0, 100) === pKey);
            if (!exists) combined[section].push(sp);
        });
    });

    return combined;
}

function getTotalBankCount() {
    const bank = getCombinedBank();
    let total = 0;
    ['pronunciation', 'stress', 'grammar', 'communication', 'notice', 'synonym', 'arrange'].forEach(s => {
        total += (bank[s] || []).length;
    });
    ['cloze', 'reading'].forEach(s => {
        (bank[s] || []).forEach(p => { total += (p.questions || []).length; });
    });
    return total;
}

function updateBankCount() {
    const count = getTotalBankCount();
    const el = document.getElementById('bank-count-number');
    if (el) el.textContent = count;
    const savedBank = loadSavedBank();
    let aiCount = 0;
    ['pronunciation', 'stress', 'grammar', 'communication', 'notice', 'synonym', 'arrange'].forEach(s => {
        aiCount += (savedBank[s] || []).length;
    });
    ['cloze', 'reading'].forEach(s => {
        (savedBank[s] || []).forEach(p => { aiCount += (p.questions || []).length; });
    });
    const aiEl = document.getElementById('bank-ai-count');
    if (aiEl) aiEl.textContent = aiCount > 0 ? `(+${aiCount} câu từ AI/Import)` : '';
}

// ─── INITIALIZATION ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAutoLogin();

    // Allow Enter key to submit forms
    document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('register-confirm')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });
});

function initLandingPage() {
    loadHistory();
    loadAPIKey();
    updateBankCount();
    showAdminButton();
    if (currentUser) {
        document.getElementById('user-display-name').textContent = currentUser.fullname;
    }
}

// ─── ADMIN ────────────────────────────────────
const ADMIN_USERNAME = 'admin';
let allUsersCache = [];

function isAdmin() {
    if (!currentUser) return false;
    // Check username or email prefix
    return currentUser.username === ADMIN_USERNAME ||
           currentUser.email === ADMIN_USERNAME + '@englishstudy.app';
}

function showAdminButton() {
    const btn = document.getElementById('btn-admin');
    if (btn) btn.style.display = isAdmin() ? '' : 'none';
}

async function openAdminPanel() {
    if (!isAdmin()) return;
    document.getElementById('admin-modal').classList.add('show');
    await loadAdminUsers();
}

function closeAdminPanel() {
    document.getElementById('admin-modal').classList.remove('show');
}

async function loadAdminUsers() {
    const listEl = document.getElementById('admin-user-list');
    const statsEl = document.getElementById('admin-stats');
    listEl.innerHTML = '<p>Đang tải...</p>';

    try {
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        allUsersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        statsEl.innerHTML = `
            <div class="admin-stat-card total">
                <span class="stat-num">${allUsersCache.length}</span>
                <span class="stat-label">Tổng tài khoản</span>
            </div>
        `;

        renderAdminUsers(allUsersCache);
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--danger)">Lỗi tải danh sách: ' + e.message + '</p>';
    }
}

function renderAdminUsers(users) {
    const listEl = document.getElementById('admin-user-list');
    if (users.length === 0) {
        listEl.innerHTML = '<p>Không tìm thấy tài khoản nào.</p>';
        return;
    }

    listEl.innerHTML = users.map((u, i) => {
        const isAdminUser = u.username === ADMIN_USERNAME;
        const created = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('vi-VN') : '';
        return `
            <div class="admin-user-row ${isAdminUser ? 'is-admin' : ''}">
                <span class="user-idx">${i + 1}</span>
                <div class="user-avatar-sm"><i class="fas fa-${isAdminUser ? 'user-shield' : 'user'}"></i></div>
                <div class="user-info-col">
                    <span class="user-fullname">${u.fullname || u.username} ${isAdminUser ? '(Admin)' : ''}</span>
                    <span class="user-username">@${u.username} | ${u.email || ''}</span>
                </div>
                <span class="user-date">${created}</span>
                <div class="admin-user-actions">
                    <button class="btn-view-history" onclick="viewUserHistory('${u.id}', '${u.fullname || u.username}')"><i class="fas fa-history"></i></button>
                    ${isAdminUser ? '' : `<button class="btn-delete-user" onclick="deleteUser('${u.id}', '${u.username}')"><i class="fas fa-trash"></i></button>`}
                </div>
            </div>
        `;
    }).join('');
}

async function viewUserHistory(uid, displayName) {
    document.getElementById('admin-history-modal').classList.add('show');
    document.getElementById('admin-history-username').textContent = displayName;
    const listEl = document.getElementById('admin-history-list');
    listEl.innerHTML = '<p>Đang tải...</p>';

    try {
        const snapshot = await db.collection('users').doc(uid)
            .collection('history').orderBy('createdAt', 'desc').limit(50).get();
        const history = snapshot.docs.map(doc => doc.data());

        if (history.length === 0) {
            listEl.innerHTML = '<p class="no-history">Chưa có lịch sử làm bài</p>';
            return;
        }

        listEl.innerHTML = history.map((item, idx) => {
            const score = parseFloat(item.score);
            const level = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';

            let sectionHTML = '';
            if (item.sectionBreakdown) {
                sectionHTML = Object.keys(item.sectionBreakdown).map(s => {
                    const d = item.sectionBreakdown[s];
                    const pct = Math.round((d.correct / d.total) * 100);
                    return `<span class="admin-section-tag">${d.label}: ${d.correct}/${d.total} (${pct}%)</span>`;
                }).join('');
            }

            return `
                <div class="admin-history-item">
                    <div class="admin-history-header">
                        <span class="admin-history-rank">#${idx + 1}</span>
                        <span class="admin-history-date"><i class="fas fa-calendar"></i> ${item.date || ''}</span>
                        <span class="admin-history-score ${level}">${item.score}/10</span>
                    </div>
                    <div class="admin-history-stats">
                        <span class="stat-ok"><i class="fas fa-check"></i> ${item.correct} đúng</span>
                        <span class="stat-fail"><i class="fas fa-times"></i> ${item.wrong} sai</span>
                        <span class="stat-skip"><i class="fas fa-minus"></i> ${item.unanswered} bỏ</span>
                        <span class="stat-time"><i class="fas fa-clock"></i> ${item.timeUsed} phút</span>
                    </div>
                    ${sectionHTML ? `<div class="admin-history-sections">${sectionHTML}</div>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--danger)">Lỗi: ' + e.message + '</p>';
    }
}

function closeAdminHistory() {
    document.getElementById('admin-history-modal').classList.remove('show');
}

function filterAdminUsers() {
    const q = document.getElementById('admin-search-input').value.toLowerCase();
    const filtered = allUsersCache.filter(u =>
        (u.fullname || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
    );
    renderAdminUsers(filtered);
}

async function deleteUser(uid, username) {
    if (!confirm(`Xác nhận xóa tài khoản @${username}?\n\nLưu ý: Thao tác này sẽ xóa dữ liệu Firestore. Tài khoản Firebase Auth cần xóa thủ công trong Firebase Console.`)) return;

    try {
        // Delete history subcollection
        const historySnap = await db.collection('users').doc(uid).collection('history').get();
        const batch = db.batch();
        historySnap.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('users').doc(uid));
        await batch.commit();

        showToast(`Đã xóa dữ liệu tài khoản @${username}`, 'success');
        await loadAdminUsers();
    } catch (e) {
        showToast('Lỗi xóa: ' + e.message, 'error');
    }
}

// ─── FIREBASE AUTHENTICATION ──────────────────
function showAuthLoading(show) {
    const overlay = document.getElementById('auth-loading');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

async function handleRegister() {
    const fullname = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const errorEl = document.getElementById('register-error');

    errorEl.textContent = '';

    if (!fullname) { errorEl.textContent = 'Vui lòng nhập họ và tên'; return; }
    if (!username || username.length < 3) { errorEl.textContent = 'Tên đăng nhập phải có ít nhất 3 ký tự'; return; }
    if (/[^a-z0-9_.]/.test(username)) { errorEl.textContent = 'Tên đăng nhập chỉ gồm chữ thường, số, dấu _ và .'; return; }
    if (!password || password.length < 6) { errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự'; return; }
    if (password !== confirm) { errorEl.textContent = 'Mật khẩu xác nhận không khớp'; return; }

    showAuthLoading(true);
    authHandledManually = true;
    try {
        const email = username + '@englishstudy.app';
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: fullname });

        await db.collection('users').doc(cred.user.uid).set({
            username, fullname, email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        currentUser = { uid: cred.user.uid, username, fullname, email };
        showAuthLoading(false);
        showToast(`Đăng ký thành công! Chào mừng ${fullname}`, 'success');
        showPage('landing-page');
        initLandingPage();
    } catch (e) {
        showAuthLoading(false);
        authHandledManually = false;
        if (e.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'Tên đăng nhập đã tồn tại';
        } else if (e.code === 'auth/weak-password') {
            errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
        } else {
            errorEl.textContent = 'Lỗi đăng ký: ' + e.message;
        }
    }
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.textContent = '';

    if (!username) { errorEl.textContent = 'Vui lòng nhập tên đăng nhập'; return; }
    if (!password) { errorEl.textContent = 'Vui lòng nhập mật khẩu'; return; }

    showAuthLoading(true);
    authHandledManually = true;
    try {
        const email = username + '@englishstudy.app';
        const cred = await auth.signInWithEmailAndPassword(email, password);

        const doc = await db.collection('users').doc(cred.user.uid).get();
        const data = doc.exists ? doc.data() : {};

        currentUser = {
            uid: cred.user.uid,
            username: data.username || username,
            fullname: data.fullname || cred.user.displayName || username,
            email
        };

        showAuthLoading(false);
        showToast(`Chào mừng ${currentUser.fullname} quay lại!`, 'success');
        showPage('landing-page');
        initLandingPage();
    } catch (e) {
        showAuthLoading(false);
        authHandledManually = false;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            errorEl.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng';
        } else {
            errorEl.textContent = 'Lỗi đăng nhập: ' + e.message;
        }
    }
}

async function handleLogout() {
    try { await auth.signOut(); } catch (e) { console.error(e); }
    currentUser = null;
    const fields = ['login-username', 'login-password', 'register-fullname', 'register-username', 'register-password', 'register-confirm'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    showLoginForm();
    showPage('auth-page');
    showToast('Đã đăng xuất', 'info');
}

let authHandledManually = false;

function checkAutoLogin() {
    auth.onAuthStateChanged(async (user) => {
        // Always hide loading
        showAuthLoading(false);

        // Skip if login/register already handled it
        if (authHandledManually) {
            authHandledManually = false;
            return;
        }

        if (user) {
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                const data = doc.exists ? doc.data() : {};
                currentUser = {
                    uid: user.uid,
                    username: data.username || user.email?.split('@')[0] || '',
                    fullname: data.fullname || user.displayName || '',
                    email: user.email
                };
                showPage('landing-page');
                initLandingPage();
            } catch (e) {
                console.error('Auto login error:', e);
                showPage('auth-page');
            }
        } else {
            currentUser = null;
            showPage('auth-page');
        }
    });
}

function showLoginForm() {
    document.getElementById('login-form').style.display = '';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-error').textContent = '';
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = '';
    document.getElementById('register-error').textContent = '';
}

// ─── API KEY MANAGEMENT ────────────────────────
function loadAPIKey() {
    const savedKey = localStorage.getItem('openai_api_key');
    const input = document.getElementById('api-key-input');
    if (input && savedKey) {
        input.value = savedKey;
    }
}

function saveAPIKey() {
    const input = document.getElementById('api-key-input');
    if (input) {
        const key = input.value.trim();
        if (key) {
            localStorage.setItem('openai_api_key', key);
            showToast('Đã lưu API Key thành công!', 'success');
        } else {
            localStorage.removeItem('openai_api_key');
            showToast('Đã xóa API Key', 'info');
        }
    }
}

function getAPIKey() {
    return localStorage.getItem('openai_api_key') || '';
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function toggleKeyVisibility() {
    const input = document.getElementById('api-key-input');
    const icon = document.getElementById('key-eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function toggleGuide() {
    const content = document.getElementById('guide-content');
    const arrow = document.getElementById('guide-arrow');
    if (content.style.display === 'none') {
        content.style.display = '';
        arrow.classList.add('open');
    } else {
        content.style.display = 'none';
        arrow.classList.remove('open');
    }
}

// ─── TOAST NOTIFICATION ────────────────────────
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── EXAM GENERATION ───────────────────────────
async function startExam() {
    examFinished = false;
    userAnswers = {};
    currentExam = [];
    timeRemaining = EXAM_DURATION;

    const apiKey = getAPIKey();

    if (apiKey) {
        // Always use AI when API key is available
        showLoading(true);
        try {
            currentExam = await generateExamWithAI();
            showLoading(false);
            // Save AI-generated questions to grow the bank
            const newCount = saveQuestionsToBank(currentExam);
            updateBankCount();
            const totalCount = getTotalBankCount();
            if (newCount > 0) {
                showToast(`AI tạo đề thành công! +${newCount} câu mới → Ngân hàng: ${totalCount} câu`, 'success');
            } else {
                showToast('AI tạo đề thành công!', 'success');
            }
        } catch (error) {
            console.error('AI generation failed:', error);
            showLoading(false);
            const totalCount = getTotalBankCount();
            showToast(`AI lỗi. Dùng ngân hàng ${totalCount} câu hỏi...`, 'error');
            currentExam = generateExamFromBank();
        }
    } else {
        currentExam = generateExamFromBank();
    }

    renderExam();
    showPage('exam-page');
    startTimer();
    examStartTime = Date.now();
}

function generateExamFromBank() {
    const bank = getCombinedBank();
    const exam = [];
    let questionNumber = 1;

    // 1. Pronunciation (2 questions)
    const pronQuestions = shuffleArray([...bank.pronunciation]).slice(0, 2);
    pronQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'pronunciation' });
    });

    // 2. Stress (2 questions)
    const stressQuestions = shuffleArray([...bank.stress]).slice(0, 2);
    stressQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'stress' });
    });

    // 3. Grammar (10 questions)
    const grammarQuestions = shuffleArray([...bank.grammar]).slice(0, 10);
    grammarQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'grammar' });
    });

    // 4. Communication (4 questions)
    const commQuestions = shuffleArray([...bank.communication]).slice(0, 4);
    commQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'communication' });
    });

    // 5. Notice (4 questions)
    const noticeQuestions = shuffleArray([...bank.notice]).slice(0, 4);
    noticeQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'notice' });
    });

    // 6. Synonym (4 questions)
    const synQuestions = shuffleArray([...bank.synonym]).slice(0, 4);
    synQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'synonym' });
    });

    // 7. Arrange (2 questions)
    const arrQuestions = shuffleArray([...bank.arrange]).slice(0, 2);
    arrQuestions.forEach(q => {
        exam.push({ ...q, number: questionNumber++, section: 'arrange' });
    });

    // 8. Cloze (1 passage, 4 questions)
    const clozePassage = shuffleArray([...bank.cloze])[0];
    clozePassage.questions.forEach(q => {
        exam.push({
            ...q,
            number: questionNumber++,
            section: 'cloze',
            passage: clozePassage.passage,
            passageTitle: clozePassage.title,
            passageId: clozePassage.id
        });
    });

    // 9. Reading (2 passages, 4 questions each = 8)
    const readingPassages = shuffleArray([...bank.reading]).slice(0, 2);
    readingPassages.forEach(passage => {
        passage.questions.forEach(q => {
            exam.push({
                ...q,
                number: questionNumber++,
                section: 'reading',
                passage: passage.passage,
                passageTitle: passage.title,
                passageId: passage.id
            });
        });
    });

    return exam;
}

// ─── AI QUESTION GENERATION ────────────────────
async function generateExamWithAI() {
    const apiKey = getAPIKey();
    if (!apiKey) throw new Error('No API key');

    // Try multiple Gemini models as fallback
    const models = ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Bạn là chuyên gia ra đề thi tiếng Anh vào lớp 10 tại Hà Nội. Luôn trả về JSON hợp lệ, không markdown, không code block.\n\n' + AI_EXAM_PROMPT
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 8000,
                        responseMimeType: 'application/json'
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                lastError = errorData.error?.message || `API Error: ${response.status}`;
                console.warn(`Model ${model} failed:`, lastError);
                continue;
            }

            const data = await response.json();
            const content = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(content);
            return convertAIResponseToExam(parsed);
        } catch (e) {
            lastError = e.message;
            console.warn(`Model ${model} error:`, e.message);
            continue;
        }
    }

    throw new Error(lastError || 'Tất cả model đều thất bại. Vui lòng thử lại sau.');
}

function convertAIResponseToExam(aiData) {
    const exam = [];
    let questionNumber = 1;

    // Process single-question sections
    const singleSections = ['pronunciation', 'stress', 'grammar', 'communication', 'notice', 'synonym', 'arrange'];
    singleSections.forEach(section => {
        if (aiData[section] && Array.isArray(aiData[section])) {
            aiData[section].forEach(q => {
                exam.push({
                    id: `ai_${section}_${questionNumber}`,
                    question: q.question,
                    options: q.options,
                    correct: q.correct,
                    explanation: q.explanation,
                    tip: q.tip,
                    number: questionNumber++,
                    section: section
                });
            });
        }
    });

    // Process cloze
    if (aiData.cloze) {
        const clozeData = aiData.cloze;
        if (clozeData.questions && Array.isArray(clozeData.questions)) {
            clozeData.questions.forEach(q => {
                exam.push({
                    id: `ai_cloze_${questionNumber}`,
                    question: q.question,
                    options: q.options,
                    correct: q.correct,
                    explanation: q.explanation,
                    tip: q.tip,
                    number: questionNumber++,
                    section: 'cloze',
                    passage: clozeData.passage,
                    passageTitle: 'Cloze Test',
                    passageId: 'ai_cloze'
                });
            });
        }
    }

    // Process reading
    if (aiData.reading && Array.isArray(aiData.reading)) {
        aiData.reading.forEach((passage, pIdx) => {
            if (passage.questions && Array.isArray(passage.questions)) {
                passage.questions.forEach(q => {
                    exam.push({
                        id: `ai_reading_${questionNumber}`,
                        question: q.question,
                        options: q.options,
                        correct: q.correct,
                        explanation: q.explanation,
                        tip: q.tip,
                        number: questionNumber++,
                        section: 'reading',
                        passage: passage.passage,
                        passageTitle: passage.title || `Đoạn văn ${pIdx + 1}`,
                        passageId: `ai_reading_${pIdx}`
                    });
                });
            }
        });
    }

    if (exam.length < 30) {
        throw new Error('AI generated insufficient questions');
    }

    return exam;
}

// ─── RENDER EXAM ───────────────────────────────
function renderExam() {
    const questionArea = document.getElementById('question-area');
    questionArea.innerHTML = '';

    let currentSection = '';
    let currentPassageId = '';

    currentExam.forEach((q, index) => {
        // Section header
        if (q.section !== currentSection) {
            currentSection = q.section;
            const sectionKey = q.section === 'stress' ? 'stress' : q.section;
            const config = SECTION_CONFIG[sectionKey];
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'question-section';
            sectionDiv.innerHTML = `
                <div class="section-title">
                    <span class="badge ${config.badge}"><i class="fas ${config.icon}"></i></span>
                    ${config.label}
                </div>
            `;
            questionArea.appendChild(sectionDiv);
            currentPassageId = '';
        }

        // Passage (for cloze and reading)
        if (q.passage && q.passageId !== currentPassageId) {
            currentPassageId = q.passageId;
            const passageDiv = document.createElement('div');
            passageDiv.className = 'passage-box';
            passageDiv.innerHTML = `<strong>${q.passageTitle || 'Đọc đoạn văn sau:'}</strong><br><br>${formatPassage(q.passage)}`;
            questionArea.appendChild(passageDiv);
        }

        // Question card
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `question-${q.number}`;
        card.innerHTML = `
            <div class="question-text">
                <span class="question-number">${q.number}.</span>
                <span>${q.question}</span>
            </div>
            <div class="options-list">
                ${q.options.map((opt, optIdx) => `
                    <div class="option-item" onclick="selectOption(${q.number}, ${optIdx})" id="opt-${q.number}-${optIdx}">
                        <span class="option-letter">${String.fromCharCode(65 + optIdx)}</span>
                        <span>${opt}</span>
                    </div>
                `).join('')}
            </div>
        `;
        questionArea.appendChild(card);
    });

    renderNavButtons();
    updateAnsweredCount();
}

function formatPassage(text) {
    // Replace (29), (30), etc. with styled blanks
    return text.replace(/\((\d+)\)/g, '<span class="blank">($1)</span>')
               .replace(/\n/g, '<br>');
}

function renderNavButtons() {
    // Clear all nav containers
    const navIds = ['nav-phonetics', 'nav-grammar', 'nav-communication', 'nav-notice', 'nav-synonym', 'nav-arrange', 'nav-cloze', 'nav-reading'];
    navIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    currentExam.forEach(q => {
        let navId;
        if (q.section === 'pronunciation' || q.section === 'stress') {
            navId = 'nav-phonetics';
        } else {
            navId = `nav-${q.section}`;
        }

        const container = document.getElementById(navId);
        if (container) {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.id = `nav-btn-${q.number}`;
            btn.textContent = q.number;
            btn.onclick = () => scrollToQuestion(q.number);
            container.appendChild(btn);
        }
    });
}

// ─── USER INTERACTION ──────────────────────────
function selectOption(questionNumber, optionIndex) {
    const question = currentExam.find(q => q.number === questionNumber);
    if (!question || examFinished) return;

    // Remove previous selection
    question.options.forEach((_, idx) => {
        const el = document.getElementById(`opt-${questionNumber}-${idx}`);
        if (el) el.classList.remove('selected');
    });

    // Set new selection
    const selectedEl = document.getElementById(`opt-${questionNumber}-${optionIndex}`);
    if (selectedEl) selectedEl.classList.add('selected');

    userAnswers[questionNumber] = optionIndex;

    // Update nav button
    const navBtn = document.getElementById(`nav-btn-${questionNumber}`);
    if (navBtn) navBtn.classList.add('answered');

    // Update question card
    const card = document.getElementById(`question-${questionNumber}`);
    if (card) card.classList.add('active');

    updateAnsweredCount();
}

function scrollToQuestion(number) {
    const el = document.getElementById(`question-${number}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 2000);
    }
}

function updateAnsweredCount() {
    const count = Object.keys(userAnswers).length;
    const el = document.getElementById('answered-count');
    if (el) el.textContent = count;
}

// ─── TIMER ─────────────────────────────────────
function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;

        if (timeRemaining <= 0) {
            timeRemaining = 0;
            clearInterval(timerInterval);
            examFinished = true;
            updateTimerDisplay();
            // Show time up modal
            document.getElementById('timeup-modal').classList.add('show');
        } else {
            updateTimerDisplay();
        }

        // Warning states
        const timerContainer = document.getElementById('timer-container');
        if (timeRemaining <= 300 && timeRemaining > 60) {
            timerContainer.className = 'timer-container warning';
        } else if (timeRemaining <= 60) {
            timerContainer.className = 'timer-container danger';
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// ─── SUBMIT EXAM ───────────────────────────────
function submitExam() {
    if (examFinished) return;

    const unanswered = TOTAL_QUESTIONS - Object.keys(userAnswers).length;
    const modalUnanswered = document.getElementById('modal-unanswered');
    if (modalUnanswered) modalUnanswered.textContent = unanswered;

    if (unanswered > 0) {
        document.getElementById('modal-title').textContent = 'Xác nhận nộp bài?';
        document.getElementById('modal-message').innerHTML =
            `Bạn còn <strong>${unanswered}</strong> câu chưa trả lời. Bạn có chắc chắn muốn nộp bài?`;
    } else {
        document.getElementById('modal-title').textContent = 'Nộp bài?';
        document.getElementById('modal-message').textContent = 'Bạn đã trả lời tất cả câu hỏi. Xác nhận nộp bài?';
    }

    document.getElementById('confirm-modal').classList.add('show');
}

function closeModal() {
    document.getElementById('confirm-modal').classList.remove('show');
}

function confirmSubmit() {
    closeModal();
    examFinished = true;
    clearInterval(timerInterval);
    showResults();
}

// ─── RESULTS ───────────────────────────────────
function showResults() {
    document.getElementById('timeup-modal').classList.remove('show');
    examFinished = true;
    clearInterval(timerInterval);

    const results = calculateResults();
    renderResults(results);
    saveHistory(results);
    showPage('result-page');

    // Scroll to top
    window.scrollTo(0, 0);
}

function calculateResults() {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    const sectionResults = {};

    // Initialize section results
    Object.keys(SECTION_CONFIG).forEach(section => {
        sectionResults[section] = { correct: 0, total: 0, questions: [] };
    });

    currentExam.forEach(q => {
        const userAnswer = userAnswers[q.number];
        const isCorrect = userAnswer === q.correct;
        const isAnswered = userAnswer !== undefined;

        if (isAnswered && isCorrect) {
            correct++;
        } else if (isAnswered && !isCorrect) {
            wrong++;
        } else {
            unanswered++;
        }

        if (sectionResults[q.section]) {
            sectionResults[q.section].total++;
            if (isCorrect) sectionResults[q.section].correct++;
            sectionResults[q.section].questions.push({
                ...q,
                userAnswer,
                isCorrect,
                isAnswered
            });
        }
    });

    const score = (correct / TOTAL_QUESTIONS) * 10;
    const timeUsed = Math.round((EXAM_DURATION - timeRemaining) / 60);

    return { correct, wrong, unanswered, score, timeUsed, sectionResults };
}

function renderResults(results) {
    // Score circle animation
    const scoreNumber = document.getElementById('score-number');
    const scoreRing = document.getElementById('score-ring');
    const scorePercent = results.score / 10;
    const circumference = 2 * Math.PI * 54; // r=54

    scoreNumber.textContent = results.score.toFixed(1);
    setTimeout(() => {
        scoreRing.style.strokeDashoffset = circumference * (1 - scorePercent);
    }, 100);

    // Result message
    const resultMsg = document.getElementById('result-message');
    if (results.score >= 8) {
        resultMsg.textContent = 'Xuất sắc! Bạn làm rất tốt!';
    } else if (results.score >= 6.5) {
        resultMsg.textContent = 'Khá tốt! Hãy tiếp tục cố gắng!';
    } else if (results.score >= 5) {
        resultMsg.textContent = 'Trung bình. Cần ôn tập thêm!';
    } else {
        resultMsg.textContent = 'Cần cố gắng nhiều hơn nữa!';
    }

    // Stats
    document.getElementById('correct-count').textContent = results.correct;
    document.getElementById('wrong-count').textContent = results.wrong;
    document.getElementById('unanswered-count').textContent = results.unanswered;
    document.getElementById('time-used').textContent = results.timeUsed;

    // Analysis
    renderAnalysis(results.sectionResults);

    // Answer details
    renderAnswerDetails(results);
}

function renderAnalysis(sectionResults) {
    const grid = document.getElementById('analysis-grid');
    const adviceDiv = document.getElementById('study-advice');
    grid.innerHTML = '';

    const strengths = [];
    const weaknesses = [];

    Object.keys(sectionResults).forEach(section => {
        const data = sectionResults[section];
        if (data.total === 0) return;

        const percent = Math.round((data.correct / data.total) * 100);
        const config = SECTION_CONFIG[section];
        const level = percent >= 75 ? 'high' : percent >= 50 ? 'medium' : 'low';

        if (percent >= 75) {
            strengths.push(config.label);
        } else if (percent < 50) {
            weaknesses.push({ label: config.label, section });
        }

        const item = document.createElement('div');
        item.className = 'analysis-item';
        item.innerHTML = `
            <div class="analysis-item-header">
                <span class="analysis-item-name">${config.label}</span>
                <span class="analysis-item-score ${level}">${data.correct}/${data.total}</span>
            </div>
            <div class="analysis-bar">
                <div class="analysis-bar-fill ${level}" style="width: 0%"></div>
            </div>
            <div class="analysis-item-detail">${percent}% chính xác</div>
        `;
        grid.appendChild(item);

        // Animate bar
        setTimeout(() => {
            item.querySelector('.analysis-bar-fill').style.width = `${percent}%`;
        }, 300);
    });

    // Study advice
    let adviceHTML = '<h4><i class="fas fa-lightbulb"></i> Lời khuyên học tập</h4><ul class="advice-list">';

    if (strengths.length > 0) {
        adviceHTML += `<li class="advice-strength"><strong>Điểm mạnh:</strong> ${strengths.join(', ')}. Hãy duy trì phong độ này!</li>`;
    }

    if (weaknesses.length > 0) {
        const weakLabels = weaknesses.map(w => w.label).join(', ');
        adviceHTML += `<li class="advice-weakness"><strong>Cần cải thiện:</strong> ${weakLabels}. Hãy tập trung ôn tập những phần này.</li>`;

        weaknesses.forEach(w => {
            adviceHTML += `<li>${getStudyAdvice(w.section)}</li>`;
        });
    }

    if (strengths.length === 0 && weaknesses.length === 0) {
        adviceHTML += '<li>Kết quả ở mức trung bình. Hãy ôn tập đều tất cả các phần để nâng cao điểm số.</li>';
    }

    adviceHTML += '</ul>';
    adviceDiv.innerHTML = adviceHTML;
}

function getStudyAdvice(section) {
    const advice = {
        pronunciation: 'Phát âm: Học thuộc quy tắc phát âm "-ed", "-s/es" và các nhóm nguyên âm. Nghe và lặp lại theo từ điển Oxford.',
        stress: 'Trọng âm: Nắm vững quy tắc trọng âm theo hậu tố (-tion, -ic, -ous, -ful) và tiền tố. Đọc to và đánh dấu trọng âm khi học từ mới.',
        grammar: 'Ngữ pháp: Ôn lại các thì, câu bị động, câu điều kiện, câu gián tiếp, mệnh đề quan hệ. Làm nhiều bài tập và ghi chú công thức.',
        communication: 'Giao tiếp: Học thuộc các mẫu câu giao tiếp thông dụng (mời, đề nghị, xin lỗi, cảm ơn). Thực hành đối thoại hàng ngày.',
        notice: 'Biển báo: Học từ vựng liên quan đến biển báo công cộng (No + V-ing, Caution, Warning). Chú ý ngữ cảnh thực tế.',
        synonym: 'Câu đồng nghĩa: Nắm vững cách chuyển đổi câu (bị động ↔ chủ động, so sánh, câu wish, too...to ↔ enough). Làm nhiều bài tập viết lại câu.',
        arrange: 'Sắp xếp câu: Xác định chủ ngữ - động từ trước, sau đó sắp xếp các thành phần còn lại. Nhận diện cấu trúc câu quen thuộc.',
        cloze: 'Điền từ đoạn văn: Đọc toàn bộ đoạn văn trước, hiểu ngữ cảnh chung. Chú ý từ loại (N/V/Adj/Adv) và nghĩa phù hợp.',
        reading: 'Đọc hiểu: Đọc câu hỏi trước, sau đó tìm thông tin trong bài. Chú ý từ khóa và tránh suy diễn quá xa.'
    };
    return advice[section] || 'Hãy ôn tập thêm phần này.';
}

function renderAnswerDetails(results) {
    const container = document.getElementById('answers-detail');
    container.innerHTML = '';

    currentExam.forEach(q => {
        const userAnswer = userAnswers[q.number];
        const isCorrect = userAnswer === q.correct;
        const isAnswered = userAnswer !== undefined;
        const status = isAnswered ? (isCorrect ? 'correct' : 'wrong') : 'wrong';

        const card = document.createElement('div');
        card.className = `answer-card ${status}`;
        card.dataset.status = status;

        card.innerHTML = `
            <div class="answer-card-header" onclick="toggleAnswerCard(this)">
                <div class="answer-status-icon">
                    <i class="fas fa-${isCorrect ? 'check' : 'times'}"></i>
                </div>
                <div class="answer-card-question">
                    <strong>Câu ${q.number}:</strong> ${truncateText(q.question, 80)}
                </div>
                <div class="answer-card-toggle">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
            <div class="answer-card-body">
                <div class="answer-options">
                    ${q.options.map((opt, idx) => {
                        let cls = '';
                        if (idx === q.correct) cls = 'is-correct';
                        else if (idx === userAnswer && !isCorrect) cls = 'is-wrong';
                        return `
                            <div class="answer-option ${cls}">
                                <span class="option-marker">${String.fromCharCode(65 + idx)}</span>
                                <span>${opt}</span>
                                ${idx === q.correct ? ' <i class="fas fa-check" style="margin-left:auto; color:var(--success)"></i>' : ''}
                                ${idx === userAnswer && !isCorrect ? ' <i class="fas fa-times" style="margin-left:auto; color:var(--danger)"></i>' : ''}
                            </div>
                        `;
                    }).join('')}
                    ${!isAnswered ? '<div class="answer-option is-wrong"><span class="option-marker">?</span><span><em>Chưa trả lời</em></span></div>' : ''}
                </div>
                ${!isCorrect ? `
                    <div class="explanation-box">
                        <h5><i class="fas fa-book"></i> Giải thích</h5>
                        <p>${q.explanation}</p>
                        <div class="tip">
                            <i class="fas fa-lightbulb"></i>
                            <span><strong>Mẹo:</strong> ${q.tip}</span>
                        </div>
                    </div>
                ` : `
                    <div class="explanation-box">
                        <h5><i class="fas fa-check-circle" style="color: var(--success)"></i> Chính xác!</h5>
                        <p>${q.explanation}</p>
                    </div>
                `}
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleAnswerCard(header) {
    const card = header.parentElement;
    card.classList.toggle('open');
}

function filterAnswers(type) {
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.filter-btn').classList.add('active');

    // Filter cards
    document.querySelectorAll('.answer-card').forEach(card => {
        if (type === 'all') {
            card.style.display = '';
        } else {
            card.style.display = card.dataset.status === type ? '' : 'none';
        }
    });
}

function truncateText(text, maxLength) {
    // Remove HTML tags for truncation
    const plain = text.replace(/<[^>]*>/g, '');
    if (plain.length <= maxLength) return plain;
    return plain.substring(0, maxLength) + '...';
}

// ─── HISTORY ───────────────────────────────────
// ─── HISTORY (Firestore + localStorage fallback) ──
let cachedHistory = [];

async function saveHistory(results) {
    const sectionBreakdown = {};
    Object.keys(results.sectionResults).forEach(section => {
        const data = results.sectionResults[section];
        if (data.total > 0) {
            sectionBreakdown[section] = {
                correct: data.correct,
                total: data.total,
                label: SECTION_CONFIG[section]?.label || section
            };
        }
    });

    const entry = {
        date: new Date().toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }),
        score: results.score.toFixed(1),
        correct: results.correct,
        wrong: results.wrong,
        unanswered: results.unanswered,
        total: TOTAL_QUESTIONS,
        timeUsed: results.timeUsed,
        sectionBreakdown,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firestore
    if (currentUser?.uid) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('history').add(entry);
        } catch (e) {
            console.error('Firestore save error:', e);
        }
    }

    // Also save to localStorage as cache
    cachedHistory.unshift(entry);
    if (cachedHistory.length > 50) cachedHistory.length = 50;
}

async function loadHistory() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;

    listEl.innerHTML = '<p class="no-history">Đang tải lịch sử...</p>';

    // Load from Firestore
    if (currentUser?.uid) {
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid)
                .collection('history').orderBy('createdAt', 'desc').limit(50).get();
            cachedHistory = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error('Firestore load error:', e);
        }
    }

    if (cachedHistory.length === 0) {
        listEl.innerHTML = '<p class="no-history">Chưa có lịch sử làm bài</p>';
        return;
    }

    listEl.innerHTML = cachedHistory.map((item, index) => {
        const score = parseFloat(item.score);
        const level = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';
        return `
            <div class="history-item" onclick="viewHistoryDetail(${index})">
                <div class="history-item-left">
                    <span class="history-rank">#${index + 1}</span>
                    <div class="history-info">
                        <span class="history-date">${item.date}</span>
                        <span class="history-stats">${item.correct}/${item.total} đúng | ${item.timeUsed} phút</span>
                    </div>
                </div>
                <div class="history-item-right">
                    <span class="history-score ${level}">${item.score}</span>
                    <i class="fas fa-chevron-right history-arrow"></i>
                </div>
            </div>
        `;
    }).join('');
}

function viewHistoryDetail(index) {
    const item = cachedHistory[index];
    if (!item) return;

    const score = parseFloat(item.score);
    const level = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';
    const levelText = score >= 8 ? 'Xuất sắc' : score >= 6.5 ? 'Khá tốt' : score >= 5 ? 'Trung bình' : 'Cần cố gắng';

    let sectionHTML = '';
    if (item.sectionBreakdown) {
        sectionHTML = '<div class="detail-sections"><h4><i class="fas fa-chart-pie"></i> Chi tiết theo từng phần</h4>';
        Object.keys(item.sectionBreakdown).forEach(section => {
            const s = item.sectionBreakdown[section];
            const pct = Math.round((s.correct / s.total) * 100);
            const sLevel = pct >= 75 ? 'high' : pct >= 50 ? 'medium' : 'low';
            sectionHTML += `
                <div class="detail-section-row">
                    <span class="detail-section-name">${s.label}</span>
                    <div class="detail-section-bar"><div class="detail-section-fill ${sLevel}" style="width:${pct}%"></div></div>
                    <span class="detail-section-score ${sLevel}">${s.correct}/${s.total}</span>
                </div>
            `;
        });
        sectionHTML += '</div>';
    }

    const content = document.getElementById('history-detail-content');
    content.innerHTML = `
        <div class="detail-header-info">
            <div class="detail-score-big ${level}">${item.score}<span>/10</span></div>
            <div class="detail-level ${level}">${levelText}</div>
            <div class="detail-date"><i class="fas fa-calendar-alt"></i> ${item.date}</div>
        </div>
        <div class="detail-stats-grid">
            <div class="detail-stat">
                <i class="fas fa-check-circle" style="color:var(--success)"></i>
                <span>${item.correct} đúng</span>
            </div>
            <div class="detail-stat">
                <i class="fas fa-times-circle" style="color:var(--danger)"></i>
                <span>${item.wrong || (item.total - item.correct - (item.unanswered || 0))} sai</span>
            </div>
            <div class="detail-stat">
                <i class="fas fa-minus-circle" style="color:var(--gray-400)"></i>
                <span>${item.unanswered || 0} bỏ qua</span>
            </div>
            <div class="detail-stat">
                <i class="fas fa-clock" style="color:var(--info)"></i>
                <span>${item.timeUsed} phút</span>
            </div>
        </div>
        ${sectionHTML}
    `;

    document.getElementById('history-detail-modal').classList.add('show');
}

function closeHistoryDetail() {
    document.getElementById('history-detail-modal').classList.remove('show');
}

// ─── NAVIGATION ────────────────────────────────
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function goHome() {
    examFinished = true;
    clearInterval(timerInterval);
    loadHistory();
    showPage('landing-page');
    // Reset timer display
    const timerContainer = document.getElementById('timer-container');
    if (timerContainer) timerContainer.className = 'timer-container';
}

function retryExam() {
    startExam();
}

// ─── LOADING ───────────────────────────────────
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// ─── AI GENERATE TO BANK ──────────────────────
async function generateAIQuestions() {
    const apiKey = getAPIKey();
    if (!apiKey) {
        showToast('Vui lòng nhập API Key trước!', 'error');
        return;
    }

    const btn = document.getElementById('btn-ai-generate');
    const progressEl = document.getElementById('ai-generate-progress');
    const progressFill = document.getElementById('ai-generate-progress-fill');
    const statusEl = document.getElementById('ai-generate-status');

    // Disable button, show progress
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> AI đang tạo câu hỏi...';
    progressEl.style.display = '';
    progressFill.style.width = '20%';
    progressFill.style.background = '';
    statusEl.textContent = 'AI đang tạo 40 câu hỏi mới...';

    try {
        progressFill.style.width = '40%';
        const exam = await generateExamWithAI();

        progressFill.style.width = '70%';
        statusEl.textContent = 'Đang lưu vào ngân hàng câu hỏi...';

        const newCount = saveQuestionsToBank(exam);
        updateBankCount();
        const totalCount = getTotalBankCount();

        progressFill.style.width = '100%';
        statusEl.textContent = 'Hoàn tất!';

        if (newCount > 0) {
            showToast(`AI tạo thành công! +${newCount} câu mới → Tổng: ${totalCount} câu`, 'success');
        } else {
            showToast(`AI tạo xong nhưng tất cả đã có trong ngân hàng. Tổng: ${totalCount} câu`, 'info');
        }
    } catch (error) {
        console.error('AI generate error:', error);
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';
        statusEl.textContent = 'Lỗi!';
        showToast('Lỗi tạo câu hỏi: ' + error.message, 'error');

        setTimeout(() => { progressFill.style.background = ''; }, 3000);
    }

    // Reset button
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Tạo 40 câu hỏi bằng AI';
}

// ─── FILE IMPORT ──────────────────────────────
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileNameEl = document.getElementById('import-file-name');
    const progressEl = document.getElementById('import-progress');
    const progressFill = document.getElementById('import-progress-fill');
    const statusEl = document.getElementById('import-status');
    const resultEl = document.getElementById('import-result');

    fileNameEl.textContent = file.name;
    progressEl.style.display = '';
    resultEl.style.display = 'none';
    progressFill.style.width = '10%';
    progressFill.style.background = '';
    statusEl.textContent = 'Đang đọc file...';

    try {
        let text = '';
        if (file.name.endsWith('.docx')) {
            text = await readDocxFile(file);
        } else if (file.name.endsWith('.pdf')) {
            text = await readPdfFile(file);
        } else {
            throw new Error('Chỉ hỗ trợ file .docx và .pdf');
        }

        progressFill.style.width = '50%';
        statusEl.textContent = 'Đang phân tích câu hỏi...';

        const questions = parseExamText(text);
        progressFill.style.width = '80%';
        statusEl.textContent = 'Đang lưu vào ngân hàng câu hỏi...';

        if (questions.length === 0) {
            throw new Error('Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng kiểm tra định dạng đề thi.');
        }

        const newCount = saveImportedQuestions(questions);
        updateBankCount();
        const totalCount = getTotalBankCount();

        progressFill.style.width = '100%';
        statusEl.textContent = 'Hoàn tất!';

        resultEl.style.display = '';
        resultEl.className = 'import-result success';
        resultEl.innerHTML = `<i class="fas fa-check-circle"></i> Import thành công! Đã thêm <strong>${newCount}</strong> câu hỏi mới. Tổng ngân hàng: <strong>${totalCount}</strong> câu.`;

        showToast(`Import thành công! +${newCount} câu → Tổng: ${totalCount} câu`, 'success');

    } catch (error) {
        console.error('Import error:', error);
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--danger)';
        statusEl.textContent = 'Lỗi!';

        resultEl.style.display = '';
        resultEl.className = 'import-result error';
        resultEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message}`;

        showToast('Import thất bại: ' + error.message, 'error');
    }

    // Reset file input
    event.target.value = '';

    // Reset progress bar color after delay
    setTimeout(() => {
        progressFill.style.background = '';
    }, 3000);
}

async function readDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function readPdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
}

function parseExamText(text) {
    const questions = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Try to find answer key section
    const answerKey = extractAnswerKey(text);

    // Parse questions with pattern: number. question text + A/B/C/D options
    let i = 0;
    while (i < lines.length) {
        const qMatch = lines[i].match(/^(?:(?:Câu|Question|Q)\s*)?(\d+)[.):\s]+(.+)/i);
        if (qMatch) {
            const qNum = parseInt(qMatch[1]);
            let qText = qMatch[2].trim();

            // Collect multi-line question text until we hit option A
            let j = i + 1;
            while (j < lines.length && !isOptionLine(lines[j]) && !isQuestionLine(lines[j])) {
                qText += ' ' + lines[j];
                j++;
            }

            // Try parsing inline options first: A. xxx  B. xxx  C. xxx  D. xxx
            const inlineOpts = extractInlineOptions(qText);
            const options = [];

            if (inlineOpts) {
                qText = inlineOpts.question;
                inlineOpts.options.forEach(o => options.push(o));
            } else {
                // Collect options line by line
                let optIdx = 0;
                while (j < lines.length && optIdx < 4) {
                    const optMatch = lines[j].match(/^([A-D])[.):\s]+(.+)/i);
                    if (optMatch) {
                        options.push(optMatch[2].trim());
                        optIdx++;
                        j++;
                    } else if (isQuestionLine(lines[j])) {
                        break;
                    } else {
                        if (options.length > 0) {
                            options[options.length - 1] += ' ' + lines[j];
                        }
                        j++;
                    }
                }
            }

            if (options.length >= 4) {
                let correct = 0;
                if (answerKey[qNum] !== undefined) {
                    correct = answerKey[qNum];
                }

                questions.push({
                    id: `import_${Date.now()}_${qNum}`,
                    question: cleanQuestionText(qText),
                    options: options.slice(0, 4),
                    correct: correct,
                    explanation: '',
                    tip: ''
                });
            }

            i = j;
        } else {
            i++;
        }
    }

    return questions;
}

function isOptionLine(line) {
    return /^[A-D][.):\s]/i.test(line);
}

function isQuestionLine(line) {
    return /^(?:(?:Câu|Question|Q)\s*)?\d+[.):\s]/i.test(line);
}

function extractInlineOptions(text) {
    const match = text.match(/^(.+?)\s+A[.):\s]+(.+?)\s+B[.):\s]+(.+?)\s+C[.):\s]+(.+?)\s+D[.):\s]+(.+)$/i);
    if (match) {
        return {
            question: match[1].trim(),
            options: [match[2].trim(), match[3].trim(), match[4].trim(), match[5].trim()]
        };
    }
    return null;
}

function extractAnswerKey(text) {
    const answers = {};
    const lines = text.split('\n');

    let inAnswerSection = false;
    for (const line of lines) {
        const trimmed = line.trim();

        // Detect answer key headers
        if (/(?:đáp án|answer key|answers?|key|đ[aá]p [aá]n)/i.test(trimmed) && trimmed.length < 60) {
            inAnswerSection = true;
        }

        if (inAnswerSection) {
            // Pattern: 1. A  2. B  3. C ...
            const multiMatch = [...trimmed.matchAll(/(\d+)\s*[.):-]\s*([A-D])/gi)];
            for (const m of multiMatch) {
                answers[parseInt(m[1])] = 'ABCD'.indexOf(m[2].toUpperCase());
            }

            // Pattern: 1-A 2-B
            const dashMatch = [...trimmed.matchAll(/(\d+)\s*[-–]\s*([A-D])/gi)];
            for (const m of dashMatch) {
                answers[parseInt(m[1])] = 'ABCD'.indexOf(m[2].toUpperCase());
            }

            // Pattern: 1A 2B (compact, only in answer section)
            const compactMatch = [...trimmed.matchAll(/\b(\d+)\s*([A-D])\b/gi)];
            for (const m of compactMatch) {
                answers[parseInt(m[1])] = 'ABCD'.indexOf(m[2].toUpperCase());
            }
        }
    }

    return answers;
}

function cleanQuestionText(text) {
    return text.replace(/^(?:(?:Câu|Question|Q)\s*)?\d+[.):\s]+/i, '').trim();
}

function classifyQuestion(question) {
    const q = question.question.toLowerCase();

    if (q.includes('pronounced') || q.includes('phát âm') || q.includes('underlined')) {
        return 'pronunciation';
    }
    if (q.includes('stress') || q.includes('trọng âm') || q.includes('stressed')) {
        return 'stress';
    }
    if ((q.includes('"') && q.includes('-')) || q.includes('response') || q.includes('reply to')) {
        return 'communication';
    }
    if (q.includes('sign:') || q.includes('notice:') || q.includes('biển báo') || q.includes('thông báo')) {
        return 'notice';
    }
    if (q.includes('same meaning') || q.includes('đồng nghĩa') || q.includes('closest in meaning') || q.includes('tương đương')) {
        return 'synonym';
    }
    if (q.includes('arrange') || q.includes('sắp xếp') || q.includes('correct order')) {
        return 'arrange';
    }
    return 'grammar';
}

function saveImportedQuestions(questions) {
    const savedBank = loadSavedBank();
    let newCount = 0;

    questions.forEach(q => {
        const section = classifyQuestion(q);

        const qKey = (q.question || '').substring(0, 80);
        if (!savedBank[section]) savedBank[section] = [];
        const allQuestions = [...(QUESTION_BANK[section] || []), ...savedBank[section]];
        const exists = allQuestions.some(sq => (sq.question || '').substring(0, 80) === qKey);

        if (!exists) {
            savedBank[section].push({
                id: q.id || `import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                question: q.question,
                options: q.options,
                correct: q.correct,
                explanation: q.explanation || '',
                tip: q.tip || ''
            });
            newCount++;
        }
    });

    localStorage.setItem(SAVED_BANK_KEY, JSON.stringify(savedBank));
    return newCount;
}

// ─── UTILITIES ─────────────────────────────────
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
