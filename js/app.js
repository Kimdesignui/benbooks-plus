/**
 * BenBooks Plus — SPA v3.1
 * 6-Step Flow: SMS → Homepage+Modal → Login → Welcome → Library → Detail
 *
 * Rules Compliance:
 * - /auto-normalize-images: normalizeImageUrl(), all paths use "/" prefix
 * - /component-reusability: Event delegation, factory functions, JSDoc, no inline onclick
 */

let currentPage = 'sms';
let currentBook = null;
let currentFilter = 'all';
let currentSort = 'popular';

// EPUB Reader state
let epubBook = null;
let epubRendition = null;
let epubTotalPages = 0;
let epubCurrentPage = 0;
let epubFontSize = 16;
const EPUB_FILE_PATH = 'assets/book-files/huyen-tuong-demo/';

// =============================================
// IMAGE URL NORMALIZATION (Rule: /auto-normalize-images)
// =============================================

/**
 * Normalizes an image URL to ensure consistency across platforms.
 * - External URLs (http/https/data:) are returned as-is.
 * - Internal paths get a "/" prefix if missing.
 * @param {string} url - The image URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeImageUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  // Ensure relative path on Github Pages by stripping leading slash
  if (url.startsWith('/')) url = url.substring(1);
  return url;
}

/**
 * Checks if an image URL contains problematic characters (uppercase, spaces, Unicode).
 * Logs a warning to the console if found.
 * @param {string} url - The image URL to validate
 * @returns {boolean} True if the URL is clean
 */
function validateImageUrl(url) {
  if (!url || url.startsWith('http') || url.startsWith('data:')) return true;
  const filename = url.split('/').pop();
  const hasUppercase = /[A-Z]/.test(filename);
  const hasSpaces = /\s/.test(filename);
  const hasUnicode = /[^\x00-\x7F]/.test(filename);
  if (hasUppercase || hasSpaces || hasUnicode) {
    console.warn(`[BenBooks] ⚠️ Image URL may cause issues on Linux/Netlify: "${url}"`);
    return false;
  }
  return true;
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  bindAllEvents();
  // App starts on SMS screen — header/footer hidden
});

// =============================================
// NAVIGATION
// =============================================

/**
 * Navigates to a specific page/state in the SPA.
 * Handles header/footer visibility and triggers page-specific rendering.
 * @param {string} page - Target page identifier ('sms'|'homepage'|'login'|'detail')
 * @param {Object} [data] - Optional data payload (e.g., book object for detail page)
 */
function navigateTo(page, data) {
  // Hide all page sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));

  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  const floating = document.getElementById('floating-actions');

  // Show/hide header, footer, floating based on page
  if (page === 'sms') {
    if (header) header.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (floating) floating.style.display = 'none';
  } else {
    if (header) header.style.display = '';
    if (footer) footer.style.display = '';
    if (floating) floating.style.display = '';
  }

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Page-specific actions
  if (page === 'homepage') {
    renderSidebar();
    renderBooks();
  }

  if (page === 'detail' && data) {
    currentBook = data;
    renderBookDetail(data);
    renderRelatedBooks(data);
    renderSuggestedBooks(data);
    renderDetailSidebar();
  }
}

// =============================================
// STEP 1: SMS → Click link → Homepage + Modal
// =============================================

/** Handles the SMS link click — fades out SMS screen and shows Homepage + Activation Modal */
function handleSmsLink() {
  const smsPage = document.getElementById('page-sms');
  if (smsPage) {
    smsPage.style.transition = 'opacity 0.6s ease';
    smsPage.style.opacity = '0';
    setTimeout(() => {
      navigateTo('homepage');
      // Step 2: Show activation modal
      setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('activateModal'));
        modal.show();
      }, 400);
    }, 600);
  }
}

// =============================================
// STEP 2: Activation Modal → Login
// =============================================

/** Handles the "KÍCH HOẠT TÀI KHOẢN" button — hides modal and navigates to login */
function handleActivate() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('activateModal'));
  if (modal) modal.hide();
  setTimeout(() => navigateTo('login'), 300);
}

// =============================================
// STEP 3: Login → Success Modal
// =============================================

/** Handles the login form submission — validates phone+code, shows loading, then success */
function handleLogin() {
  const phone = document.getElementById('login-phone')?.value.trim();
  const code  = document.getElementById('login-code')?.value.trim();
  if (!phone) return showToast('Vui lòng nhập số điện thoại');
  if (!code)  return showToast('Vui lòng nhập mã xác nhận SMS');

  // Show loading
  const btnText = document.querySelector('.btn-login-text');
  const btnLoader = document.querySelector('.btn-login-loader');
  if (btnText) btnText.classList.add('d-none');
  if (btnLoader) btnLoader.classList.remove('d-none');

  setTimeout(() => {
    if (btnText) btnText.classList.remove('d-none');
    if (btnLoader) btnLoader.classList.add('d-none');

    if (code === '982932') {
      localStorage.setItem('benbooks_loggedIn', 'true');
      localStorage.setItem('benbooks_phone', phone);
      updateUserButton();

      // Navigate to homepage then show success modal
      navigateTo('homepage');
      setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        modal.show();
      }, 400);
    } else {
      showToast('Mã xác nhận không chính xác. Vui lòng thử lại.');
    }
  }, 1500);
}

// =============================================
// STEP 4: Success Modal → Library
// =============================================

/** Handles "VÀO ĐỌC SÁCH" — hides success modal and renders library */
function handleGoLibrary() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('successModal'));
  if (modal) modal.hide();
  renderSidebar();
  renderBooks();
}

/** Updates the user avatar button to show logged-in state */
function updateUserButton() {
  const btn = document.getElementById('btn-user');
  if (btn) {
    btn.innerHTML = '<i class="bi bi-person-check-fill"></i>';
    btn.title = 'Tài khoản';
    btn.removeAttribute('data-action');
  }
}

// =============================================
// SIDEBAR (Shared factory — Rule: Component Reusability 1.3)
// =============================================

/**
 * Creates sidebar HTML from category/topic/language data.
 * Reusable factory function for both main sidebar and detail sidebar.
 * @param {Object} options - Configuration options
 * @param {boolean} [options.compact=false] - If true, renders a compact version (detail sidebar)
 * @param {boolean} [options.accordion=true] - If true, renders categories as accordions
 * @returns {string} HTML string for the sidebar content
 */
function createSidebarHTML({ compact = false, accordion = true } = {}) {
  let html = '';

  if (typeof CATEGORIES !== 'undefined') {
    CATEGORIES.forEach((cat, ci) => {
      html += `<div class="sidebar-section">
        <div class="sidebar-section-title"><i class="bi bi-journal-bookmark"></i> ${cat.title}</div>`;

      if (accordion && !compact) {
        html += `<div class="accordion accordion-flush" id="sidebarAcc${ci}">`;
        cat.items.forEach((item, ii) => {
          const cid = `clps_${ci}_${ii}`;
          const first = ii === 0;
          html += `<div class="accordion-item border-0">
            <h2 class="accordion-header">
              <button class="accordion-button ${first ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${cid}">
                <span class="text-truncate d-inline-block sidebar-truncate">${item.name}</span>
              </button>
            </h2>
            <div id="${cid}" class="accordion-collapse collapse ${first ? 'show' : ''}" data-bs-parent="#sidebarAcc${ci}">
              <div class="accordion-body">${item.children.map(c => `<a class="sidebar-link" href="#">└ ${c}</a>`).join('')}</div>
            </div>
          </div>`;
        });
        html += '</div>';
      } else {
        // Compact mode: flat list
        cat.items.forEach(item => {
          html += `<a class="sidebar-link" href="#">${item.name}</a>`;
        });
      }

      html += '</div>';
    });
  }

  if (typeof TOPICS !== 'undefined') {
    html += `<div class="sidebar-section"><div class="sidebar-section-title"><i class="bi bi-grid-3x3-gap"></i> CHỦ ĐỀ</div>`;
    if (compact) {
      TOPICS.forEach(t => { html += `<a class="sidebar-link" href="#">${t}</a>`; });
    } else {
      html += '<ul class="topic-list">';
      TOPICS.forEach((t, i) => {
        html += `<li class="${i >= 7 ? 'd-none hidden-item' : ''}"><a href="#">${t}</a></li>`;
      });
      if (TOPICS.length > 7) {
        html += `<li><a href="#" class="see-more" data-action="toggle-see-more">Xem thêm <i class="bi bi-chevron-down"></i></a></li>`;
      }
      html += '</ul>';
    }
    html += '</div>';
  }

  if (typeof AGE_GROUPS !== 'undefined' && !compact) {
    html += `<div class="sidebar-section"><div class="sidebar-section-title"><i class="bi bi-people"></i> ĐỘ TUỔI</div><ul class="topic-list">`;
    AGE_GROUPS.forEach(a => { html += `<li><a href="#">${a}</a></li>`; });
    html += '</ul></div>';
  }

  if (typeof LANGUAGES !== 'undefined') {
    html += `<div class="sidebar-section"><div class="sidebar-section-title"><i class="bi bi-translate"></i> THEO NGÔN NGỮ</div>`;
    LANGUAGES.forEach((l, i) => { html += `<a class="sidebar-link ${i === 0 ? 'active' : ''}" href="#">${l}</a>`; });
    html += '</div>';
  }

  return html;
}

/** Renders the main sidebar (homepage) */
function renderSidebar() {
  const container = document.getElementById('sidebar-content');
  if (!container) return;
  container.innerHTML = createSidebarHTML({ compact: false, accordion: true });
}

/** Renders the detail page sidebar (compact version) */
function renderDetailSidebar() {
  const el = document.getElementById('detail-sidebar-right');
  if (!el) return;
  el.innerHTML = createSidebarHTML({ compact: true, accordion: false });
}

/**
 * Toggles "Xem thêm / Thu gọn" for topic lists.
 * @param {HTMLElement} btn - The toggle button element
 */
function handleToggleSeeMore(btn) {
  const list = btn.closest('ul');
  if (!list) return;
  const items = list.querySelectorAll('.hidden-item');
  const exp = btn.getAttribute('data-expanded') === 'true';
  items.forEach(i => i.classList.toggle('d-none'));
  btn.innerHTML = exp ? 'Xem thêm <i class="bi bi-chevron-down"></i>' : 'Thu gọn <i class="bi bi-chevron-up"></i>';
  btn.setAttribute('data-expanded', exp ? 'false' : 'true');
}

// =============================================
// BOOKS GRID
// =============================================

/**
 * Renders the book grid with optional filtering and sorting.
 * @param {string} [filter] - Optional filter ('Ebook'|'Audio'|undefined for all)
 */
function renderBooks(filter) {
  const grid = document.getElementById('books-grid');
  if (!grid || typeof BOOKS_DATA === 'undefined') return;

  let books = [...BOOKS_DATA];
  if (filter === 'Ebook') books = books.filter(b => b.type === 'Ebook');
  else if (filter === 'Audio') books = books.filter(b => b.type === 'Audio');

  books.sort((a, b) => {
    switch (currentSort) {
      case 'views': return (b.views||0) - (a.views||0);
      case 'newest': return (b.id||0) - (a.id||0);
      case 'price': return (parseInt((a.price||'0').replace(/\D/g,''),10)||0) - (parseInt((b.price||'0').replace(/\D/g,''),10)||0);
      default: return (b.editions||0) - (a.editions||0);
    }
  });

  const countEl = document.getElementById('book-count');
  if (countEl) countEl.textContent = `(${books.length})`;

  grid.innerHTML = books.map(b => createBookCard(b)).join('');
  renderPagination();
}

/**
 * Creates a book card HTML string from book data.
 * Uses normalizeImageUrl() for all image paths.
 * @param {Object} book - Book data object
 * @param {number} book.id - Unique book ID
 * @param {string} book.title - Book title
 * @param {string} book.type - Book type ('Ebook'|'Audio')
 * @param {string} [book.coverImage] - Cover image URL
 * @param {string} [book.coverColor] - Fallback background color
 * @returns {string} HTML string for the book card
 */
function createBookCard(book) {
  const typeCls = book.type === 'Audio' ? 'audio' : 'ebook';
  const typeIcon = book.type === 'Audio' ? 'bi-headphones' : 'bi-book';
  const typeLabel = book.type === 'Audio' ? 'Audio' : 'Ebook';

  const coverSrc = normalizeImageUrl(book.coverImage);
  validateImageUrl(book.coverImage);

  const cover = coverSrc
    ? `<img src="${coverSrc}" alt="${book.title}" class="book-cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const fallback = `<div class="book-cover-fallback" style="background:${book.coverColor||'#8B7355'};display:${coverSrc?'none':'flex'}"><span>${book.title}</span></div>`;

  const vipTagSrc = normalizeImageUrl('assets/img/tag-hoi-vien.svg');

  return `<div class="book-card" data-book-id="${book.id}">
    <div class="book-cover-wrapper">
      <div class="book-type-badge ${typeCls}"><i class="bi ${typeIcon}"></i> ${typeLabel}</div>
      ${cover}${fallback}
      <div class="book-vip-badge"><img src="${vipTagSrc}" alt="Hội viên" class="vip-tag-img"></div>
    </div>
    <div class="book-info"><div class="book-title">${book.title}</div></div>
  </div>`;
}

/** Renders pagination controls */
function renderPagination() {
  const list = document.getElementById('pagination-list');
  if (!list) return;
  const pages = Math.ceil((BOOKS_DATA?.length || 0) / 30) || 1;
  let h = `<li class="page-item"><a class="page-link" href="#"><i class="bi bi-chevron-left"></i></a></li>`;
  for (let i = 1; i <= pages; i++) h += `<li class="page-item ${i===1?'active':''}"><a class="page-link" href="#">${i}</a></li>`;
  h += `<li class="page-item"><a class="page-link" href="#"><i class="bi bi-chevron-right"></i></a></li>`;
  list.innerHTML = h;
}

// =============================================
// BOOK DETAIL
// =============================================

/**
 * Renders the full book detail page with cover, metadata, thumbnails, and description.
 * Uses normalizeImageUrl() for all image paths.
 * @param {Object} book - Complete book data object
 */
function renderBookDetail(book) {
  // Cover
  const coverBox = document.getElementById('detail-cover-box');
  if (coverBox) {
    const coverSrc = normalizeImageUrl(book.coverImage);
    coverBox.innerHTML = coverSrc
      ? `<img src="${coverSrc}" alt="${book.title}">`
      : `<span>${book.title}</span>`;
    coverBox.style.background = book.coverColor || '#f5f0e8';
  }

  // Thumbnails
  const thumbs = document.getElementById('detail-thumbs-list');
  if (thumbs && book.coverImage) {
    const coverSrc = normalizeImageUrl(book.coverImage);
    const tryIcon = normalizeImageUrl(book.type === 'Audio' ? 'assets/img/nghe-thu.svg' : 'assets/img/doc-thu.svg');
    const tryLabel = book.type === 'Audio' ? 'Nghe thử' : 'Đọc thử';
    thumbs.innerHTML = `
      <div class="thumb-item active"><img src="${coverSrc}" alt=""></div>
      <div class="thumb-item"><img src="${coverSrc}" alt=""></div>
      <div class="thumb-item"><img src="${coverSrc}" alt=""></div>
      <div class="thumb-item dark-overlay"><img src="${coverSrc}" alt=""><div class="overlay-text">Xem thêm<br>hình ảnh</div></div>
      <div class="thumb-action-box" data-action="read-trial" data-url="${book.readTrialUrl||'#'}"><img src="${tryIcon}" alt="${tryLabel}"><span>${tryLabel}</span></div>`;
  }

  // Text fields
  setText('detail-crumb-title', book.title);
  setText('detail-crumb-cat', (book.categories||[])[0] || 'Ebook');
  setText('detail-book-title', `[${book.type||'Ebook'}] ${book.title}`);
  setText('detail-subtitle', book.genre || 'Subtitle title');
  setText('detail-book-rating', book.rating || '4.5');
  setText('detail-book-views', (book.views||0).toLocaleString());
  setText('detail-book-editions', (book.editions||0).toLocaleString());

  // Categories
  const catLink = document.getElementById('detail-cat-link');
  if (catLink) catLink.innerHTML = (book.categories||['Sách']).map(c => `<a href="#" style="color:var(--link-blue)">${c}</a>`).join(', ');

  // Format selector (normalized image paths)
  const fmtBox = document.getElementById('detail-format-selector');
  if (fmtBox) {
    fmtBox.innerHTML = [
      { icon: 'assets/img/sach-in.svg', label: 'Sách in', active: false },
      { icon: 'assets/img/ebook.svg', label: 'Ebook', active: book.type === 'Ebook' },
      { icon: 'assets/img/audiobook.svg', label: 'Audio', active: book.type === 'Audio' },
      { icon: 'assets/img/multi-books.svg', label: 'Sách<br>tương tác', active: false }
    ].map(f => `<div class="format-box ${f.active?'active':''}">
      <img src="${normalizeImageUrl(f.icon)}" alt="${f.label}" style="${f.active?'':'filter:grayscale(1)'}">
      <div class="fmt-label">${f.label}</div>
    </div>`).join('');
  }

  // Description with toggle
  const descEl = document.getElementById('detail-book-desc');
  if (descEl) {
    descEl.innerHTML = `<div class="desc-content desc-collapsed">${book.description||'Nội dung chi tiết về cuốn sách.'}</div>
    <a href="#" class="see-more-link" data-action="toggle-description"><i class="bi bi-chevron-down"></i> Xem thêm</a>`;
  }

  // Author
  setText('detail-author-name', book.author);
  const avatarEl = document.getElementById('author-avatar');
  if (avatarEl) avatarEl.textContent = (book.author||'A')[0];

  // Pub info
  setText('pub-pages', `${book.pages||'—'} trang`);
  setText('pub-type', book.type || 'Ebook');

  prepareReaderPages();
}

/**
 * Toggles the description between collapsed and expanded.
 * @param {HTMLElement} link - The "Xem thêm / Thu gọn" link element
 */
function toggleDescription(link) {
  const desc = document.querySelector('.desc-content');
  if (!desc) return;
  const isCollapsed = desc.classList.contains('desc-collapsed');
  if (isCollapsed) {
    desc.classList.remove('desc-collapsed');
    link.innerHTML = '<i class="bi bi-chevron-up"></i> Thu gọn';
  } else {
    desc.classList.add('desc-collapsed');
    link.innerHTML = '<i class="bi bi-chevron-down"></i> Xem thêm';
  }
}

/**
 * Renders related books (same genre) in a horizontal scroll.
 * @param {Object} book - Current book to find related items for
 */
function renderRelatedBooks(book) {
  const el = document.getElementById('related-books-grid');
  if (!el) return;
  const related = BOOKS_DATA.filter(b => b.id !== book.id && b.genre === book.genre).slice(0, 6);
  const items = related.length > 0 ? related : BOOKS_DATA.filter(b => b.id !== book.id).slice(0, 6);
  el.innerHTML = `<div class="books-scroll">${items.map(b => createBookCard(b)).join('')}</div>`;
}

/**
 * Renders suggested books in a horizontal scroll.
 * @param {Object} book - Current book to exclude from suggestions
 */
function renderSuggestedBooks(book) {
  const el = document.getElementById('suggested-books-grid');
  if (!el) return;
  const items = BOOKS_DATA.filter(b => b.id !== book.id).slice(0, 10);
  el.innerHTML = `<div class="books-scroll">${items.map(b => createBookCard(b)).join('')}</div>`;
}

// =============================================
// EPUB READER (epub.js integration)
// =============================================

/**
 * Opens the EPUB reader overlay and loads the EPUB file.
 * Uses epub.js to render the .epub file with paginated spreads.
 * @param {string} [epubUrl] - Optional custom EPUB URL. Defaults to EPUB_FILE_PATH.
 */
function openReader(epubUrl) {
  const overlay = document.getElementById('reader-overlay');
  const viewer = document.getElementById('epub-viewer');
  const loading = document.getElementById('reader-loading');
  if (!overlay || !viewer) return;

  overlay.classList.add('active');
  document.body.classList.add('reader-active');
  if (currentBook) setText('reader-book-title', currentBook.title);

  // Show loading state
  if (loading) loading.style.display = 'flex';
  viewer.innerHTML = '';
  setText('page-indicator', 'Đang tải...');

  // Destroy previous book if any
  if (epubBook) {
    try { epubBook.destroy(); } catch(e) {}
    epubBook = null;
    epubRendition = null;
  }

  // Load Unarchived EPUB directly via URL point (Instantly loads without JSZip memory overhead)
  const url = EPUB_FILE_PATH;
  epubBook = ePub(url);

  // Create rendition
  epubRendition = epubBook.renderTo('epub-viewer', {
    width: '100%',
    height: '100%',
    spread: 'auto',
    flow: 'paginated',
    manager: 'default' // Default manager is faster for initial load
  });

  // Set initial font size
  epubRendition.themes.fontSize(epubFontSize + 'px');

  // Register Custom Themes
  epubRendition.themes.register("light", {
    "body": { "background": "#FFFCF5 !important", "color": "#2D2D2D !important" }
  });
  epubRendition.themes.register("dark", {
    "body": { "background": "#1E1E1E !important", "color": "#F5F5F5 !important" }
  });
  epubRendition.themes.register("sepia", {
    "body": { "background": "#F4EFE6 !important", "color": "#4A3C31 !important" }
  });

  // Apply base defaults
  epubRendition.themes.default({
    'body': { 'padding': '20px 28px !important' },
    'p': { 'text-align': 'justify !important', 'margin-bottom': '14px !important', 'text-indent': '24px !important' },
    'h1, h2, h3': { 'font-family': '"Roboto", sans-serif !important', 'border-bottom': '2px solid #FFC300 !important', 'padding-bottom': '8px !important', 'margin-bottom': '18px !important' },
    'a': { 'color': '#2F69FD !important' }
  });

  // Load from local storage or set defaults
  const savedTheme = localStorage.getItem('epubTheme') || 'light';
  epubRendition.themes.select(savedTheme);
  
  const savedFont = localStorage.getItem('epubFont') || 'sans-serif';
  const fontMapping = { 'sans-serif': '"Roboto", sans-serif', 'serif': '"Georgia", serif' };
  epubRendition.themes.font(fontMapping[savedFont]);
  
  const savedLineHeight = localStorage.getItem('epubLineHeight') || '1.8';
  epubRendition.themes.override('line-height', savedLineHeight + ' !important');

  // Sync UI settings buttons with saved states
  setTimeout(() => {
    document.querySelectorAll('.setting-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.setting-btn[data-theme="${savedTheme}"]`)?.classList.add('active');
    document.querySelector(`.setting-btn[data-font="${savedFont}"]`)?.classList.add('active');
    document.querySelector(`.setting-btn[data-lineheight="${savedLineHeight}"]`)?.classList.add('active');
  }, 100);

  // Display first page
  epubRendition.display().then(() => {
    if (loading) loading.style.display = 'none';
    updatePageIndicator();
  });

  // Load TOC
  epubBook.loaded.navigation.then(nav => {
    renderToc(nav.toc);
  });

  // Update page numbers on relocation
  epubRendition.on('relocated', (location) => {
    updatePageIndicator(location);
  });
}

/**
 * Renders the table of contents in the reader sidebar.
 * @param {Array} toc - epub.js navigation TOC array
 */
function renderToc(toc) {
  const list = document.getElementById('reader-toc-list');
  if (!list) return;
  list.innerHTML = toc.map((ch, i) => {
    const subitems = ch.subitems ? ch.subitems.map(sub =>
      `<li class="reader-toc-subitem" data-toc-href="${sub.href}">${sub.label.trim()}</li>`
    ).join('') : '';
    return `<li class="reader-toc-item" data-toc-href="${ch.href}">
      <span class="toc-chapter-num">${i + 1}</span>
      <span class="toc-chapter-label">${ch.label.trim()}</span>
    </li>${subitems}`;
  }).join('');
}

/**
 * Updates the page indicator with current location info.
 * @param {Object} [location] - epub.js location object
 */
function updatePageIndicator(location) {
  const indicator = document.getElementById('page-indicator');
  if (!indicator) return;
  if (location && location.start) {
    const current = location.start.displayed?.page || 1;
    const total = location.start.displayed?.total || 1;
    const section = location.start.index + 1;
    indicator.textContent = `Chương ${section} — Trang ${current} / ${total}`;
  }
}

/**
 * Navigates to next page in EPUB.
 */
function turnPageNext() {
  if (epubRendition) epubRendition.next();
}

/**
 * Navigates to previous page in EPUB.
 */
function turnPagePrev() {
  if (epubRendition) epubRendition.prev();
}

/**
 * Changes the reader font size.
 * @param {number} delta - Amount to change (+2 or -2)
 */
function changeReaderFontSize(delta) {
  epubFontSize = Math.max(12, Math.min(28, epubFontSize + delta));
  if (epubRendition) epubRendition.themes.fontSize(epubFontSize + 'px');
  const el = document.getElementById('reader-font-size');
  if (el) el.textContent = epubFontSize;
}

/**
 * Toggles the TOC sidebar panel.
 */
function toggleTocPanel() {
  const panel = document.getElementById('reader-toc-panel');
  if (panel) panel.classList.toggle('open');
}

/** Closes the reader overlay and cleans up epub.js resources */
function closeReader() {
  document.getElementById('reader-overlay')?.classList.remove('active');
  document.body.classList.remove('reader-active');
  // Close TOC panel
  document.getElementById('reader-toc-panel')?.classList.remove('open');
  // Destroy book to free memory
  if (epubBook) {
    try { epubBook.destroy(); } catch(e) {}
    epubBook = null;
    epubRendition = null;
  }
}

// =============================================
// EVENTS — All using Event Delegation (Rule: /component-reusability 3.2)
// =============================================

/**
 * Binds all event listeners using event delegation pattern.
 * Single listener per container, using data-action attributes and closest() matching.
 */
function bindAllEvents() {
  // -- Global click delegation on document body --
  document.body.addEventListener('click', (e) => {
    const target = e.target;

    // Prevent default on sidebar links
    if (target.classList.contains('sidebar-link')) {
      e.preventDefault();
      return;
    }

    // SMS link (Step 1)
    const smsLink = target.closest('#sms-link');
    if (smsLink) {
      e.preventDefault();
      handleSmsLink();
      return;
    }

    // Activate button (Step 2)
    if (target.closest('#btn-activate-account')) {
      handleActivate();
      return;
    }

    // Login button (Step 3)
    if (target.closest('#btn-login')) {
      handleLogin();
      return;
    }

    // Go Library button (Step 4)
    if (target.closest('#btn-go-library')) {
      handleGoLibrary();
      return;
    }

    // Header logo → homepage
    const logoLink = target.closest('.header-logo');
    if (logoLink) {
      e.preventDefault();
      navigateTo('homepage');
      return;
    }

    // User avatar → login
    const userBtn = target.closest('#btn-user');
    if (userBtn && !localStorage.getItem('benbooks_loggedIn')) {
      e.preventDefault();
      navigateTo('login');
      return;
    }

    // Gói Cước header
    if (target.closest('#btn-goicuoc-header')) {
      const m = new bootstrap.Modal(document.getElementById('activateModal'));
      m.show();
      return;
    }

    // Filter badges (delegation)
    const badge = target.closest('.filter-badge');
    if (badge) {
      document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      currentFilter = badge.dataset.filter;
      renderBooks(currentFilter);
      return;
    }

    // Sort buttons (delegation)
    const sortBtn = target.closest('.sort-btn');
    if (sortBtn) {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      sortBtn.classList.add('active');
      currentSort = sortBtn.dataset.sort || 'popular';
      renderBooks(currentFilter);
      return;
    }

    // Book cards (delegation — works for grid AND scroll sections)
    const card = target.closest('.book-card');
    if (card) {
      const id = parseInt(card.dataset.bookId);
      const book = BOOKS_DATA.find(b => b.id === id) || BOOKS_DATA[0];
      navigateTo('detail', book);
      return;
    }

    // Read Now button
    if (target.closest('#btn-read-now')) {
      openReader();
      return;
    }

    // Reader close buttons
    const readerClose = target.closest('[data-action="close-reader"]');
    if (readerClose) {
      closeReader();
      return;
    }

    // Reader prev/next
    if (target.closest('#btn-prev-page')) { turnPagePrev(); return; }
    if (target.closest('#btn-next-page')) { turnPageNext(); return; }

    // Reader TOC toggle
    if (target.closest('#btn-toggle-toc')) { toggleTocPanel(); return; }

    // Reader font size
    if (target.closest('#btn-font-decrease')) { changeReaderFontSize(-2); return; }
    if (target.closest('#btn-font-increase')) { changeReaderFontSize(2); return; }

    // Toggle settings panel
    if (target.closest('#btn-reader-settings')) {
      document.getElementById('reader-settings-panel')?.classList.toggle('active');
      return;
    }

    // Close settings panel when clicking outside
    if (!target.closest('.reader-settings-panel') && !target.closest('#btn-reader-settings')) {
      document.getElementById('reader-settings-panel')?.classList.remove('active');
    }

    // Settings: Theme
    if (target.closest('.setting-btn[data-theme]')) {
      const btn = target.closest('.setting-btn[data-theme]');
      const theme = btn.dataset.theme;
      document.querySelectorAll('.setting-btn[data-theme]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if(epubRendition) epubRendition.themes.select(theme);
      localStorage.setItem('epubTheme', theme);
      return;
    }

    // Settings: Font Family
    if (target.closest('.setting-btn[data-font]')) {
      const btn = target.closest('.setting-btn[data-font]');
      const fontObj = { 'sans-serif': '"Roboto", sans-serif', 'serif': '"Georgia", serif' };
      const val = btn.dataset.font;
      document.querySelectorAll('.setting-btn[data-font]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if(epubRendition) epubRendition.themes.font(fontObj[val] || fontObj['sans-serif']);
      localStorage.setItem('epubFont', val);
      return;
    }

    // Settings: Line Height
    if (target.closest('.setting-btn[data-lineheight]')) {
      const btn = target.closest('.setting-btn[data-lineheight]');
      const lh = btn.dataset.lineheight;
      document.querySelectorAll('.setting-btn[data-lineheight]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if(epubRendition) epubRendition.themes.override('line-height', lh + ' !important');
      localStorage.setItem('epubLineHeight', lh);
      return;
    }

    // TOC item click
    const tocItem = target.closest('[data-toc-href]');
    if (tocItem && epubRendition) {
      epubRendition.display(tocItem.dataset.tocHref);
      document.getElementById('reader-toc-panel')?.classList.remove('open');
      return;
    }

    // Scroll to top
    if (target.closest('#btn-scroll-top')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Breadcrumb / "Xem tất cả" links → homepage
    const navHomeLink = target.closest('[data-action="go-homepage"]');
    if (navHomeLink) {
      e.preventDefault();
      navigateTo('homepage');
      return;
    }

    // Toggle description
    const descToggle = target.closest('[data-action="toggle-description"]');
    if (descToggle) {
      e.preventDefault();
      toggleDescription(descToggle);
      return;
    }

    // Toggle see-more in sidebar
    const seeMoreToggle = target.closest('[data-action="toggle-see-more"]');
    if (seeMoreToggle) {
      e.preventDefault();
      handleToggleSeeMore(seeMoreToggle);
      return;
    }

    // Read trial (thumb action box)
    const readTrial = target.closest('[data-action="read-trial"]');
    if (readTrial) {
      const url = readTrial.dataset.url;
      if (url && url !== '#') window.open(url, '_blank');
      return;
    }

    // Pagination link
    const pageLink = target.closest('.page-link');
    if (pageLink) {
      e.preventDefault();
      return;
    }
  });

  // -- Keyboard events (non-delegatable on specific inputs) --
  document.getElementById('login-code')?.addEventListener('keyup', e => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('header-search-input')?.addEventListener('keyup', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim().toLowerCase();
    const grid = document.getElementById('books-grid');
    if (!q) { renderBooks(); return; }
    if (!grid) return;
    const found = BOOKS_DATA.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    if (!found.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--icon)"><i class="bi bi-search" style="font-size:44px;display:block;margin-bottom:14px"></i><p>Không tìm thấy sách phù hợp</p></div>`;
    } else {
      grid.innerHTML = found.map(b => createBookCard(b)).join('');
    }
    if (currentPage !== 'homepage') navigateTo('homepage');
  });
}

// =============================================
// UTILS
// =============================================

/**
 * Sets text content of an element by ID.
 * @param {string} id - Element ID
 * @param {string} text - Text to set
 */
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

/**
 * Shows a toast notification message.
 * @param {string} msg - Message to display
 */
function showToast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) { t = document.createElement('div'); t.id = 'app-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1'; t.style.pointerEvents = 'auto';
  setTimeout(() => { t.style.opacity = '0'; t.style.pointerEvents = 'none'; }, 3000);
}
