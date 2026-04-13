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
let currentPageIndex = 1;
const BOOKS_PER_PAGE = 30;

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

/**
 * Syncs --mobile-header-h CSS variable with the actual header element height.
 * Uses offsetHeight (always correct regardless of scroll position).
 */
function syncMobileSidebarOffset() {
  const header = document.getElementById('site-header');
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  // offsetHeight = true rendered height, NOT affected by scroll
  const headerH = header && isMobile ? header.offsetHeight : 0;
  document.documentElement.style.setProperty('--mobile-header-h', `${headerH}px`);
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  bindAllEvents();
  syncMobileSidebarOffset();
  // Re-sync after layout settles (fonts, flex-wrap may shift header height)
  requestAnimationFrame(() => syncMobileSidebarOffset());
  // Khởi tạo trang nếu đang view thẳng bằng HTML standalone
  if (document.body.getAttribute('data-page') === 'detail') {
    const dummyBook = typeof BOOKS_DATA !== 'undefined' && BOOKS_DATA.length ? BOOKS_DATA[0] : {};
    try { renderBookDetail(dummyBook); } catch(e) { console.warn('[BenBooks] renderBookDetail error:', e); }
    try { renderRelatedBooks(dummyBook); } catch(e) { console.warn('[BenBooks] renderRelatedBooks error:', e); }
    try { renderSuggestedBooks(dummyBook); } catch(e) { console.warn('[BenBooks] renderSuggestedBooks error:', e); }
    try { renderDetailSidebar(); } catch(e) { console.warn('[BenBooks] renderDetailSidebar error:', e); }

  }
  try { renderSidebar(); } catch(e) { console.warn('[BenBooks] renderSidebar error:', e); }
  // App starts on SMS screen — header/footer hidden (SPA)
  startAutoCarousel();
});

window.addEventListener('resize', syncMobileSidebarOffset);
window.addEventListener('orientationchange', syncMobileSidebarOffset);

// =============================================
// AUTO CAROUSEL SCROLLING
// =============================================
let autoScrollInterval = null;
function startAutoCarousel() {
  if (autoScrollInterval) clearInterval(autoScrollInterval);
  autoScrollInterval = setInterval(() => {
    // Only auto-scroll in detail page
    if (document.body.getAttribute('data-page') !== 'detail') return;

    const carousels = document.querySelectorAll('.books-scroll-wrap');
    carousels.forEach(container => {
      // Pause on hover
      if (container.matches(':hover') || container.closest('.suggested-carousel-wrap:hover, .related-section:hover')) return;

      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll <= 0) return;

      let newScroll = container.scrollLeft + container.clientWidth * 0.8;
      if (container.scrollLeft >= maxScroll - 10) {
        newScroll = 0; // reset
      }
      container.scrollTo({ left: newScroll, behavior: 'smooth' });
    });
  }, 4000);
}

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
    if (header) header.classList.add('d-none');
    if (footer) footer.classList.add('d-none');
    if (floating) floating.classList.add('d-none');
  } else {
    if (header) header.classList.remove('d-none', 'hidden-init');
    if (footer) footer.classList.remove('d-none', 'hidden-init');
    if (floating) floating.classList.remove('d-none', 'hidden-init');
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
      navigateTo('login');
    }, 600);
  }
}

// =============================================
// STEP 2: Activation Modal → Login
// =============================================

/** Handles the "KÍCH HOẠT TÀI KHOẢN" button — hides modal and navigates to login */
// =============================================
// STEP 3: Login → Success Modal
// =============================================

/** Handles the login form submission — validates phone+code, shows loading, then success */
function handleLogin() {
  const phone = document.getElementById('login-phone')?.value.trim();
  const code = document.getElementById('login-code')?.value.trim();
  if (!phone) return showToast('Vui lòng nhập số điện thoại');
  if (!code) return showToast('Vui lòng nhập mã xác nhận SMS');

  // Show loading
  const btnText = document.querySelector('.btn-login-text');
  const btnLoader = document.querySelector('.btn-login-loader');
  if (btnText) btnText.classList.add('d-none');
  if (btnLoader) btnLoader.classList.remove('d-none');

  setTimeout(() => {
    if (btnText) btnText.classList.remove('d-none');
    if (btnLoader) btnLoader.classList.add('d-none');

    if (code === 'uB0!$d4C$6Sd') {
      localStorage.setItem('benbooks_loggedIn', 'true');
      localStorage.setItem('benbooks_phone', phone);
      updateUserButton();

      // Standalone login page: go straight to account page.
      if (!document.getElementById('page-homepage')) {
        window.location.href = 'my-account.html';
        return;
      }

      // SPA flow: navigate to homepage then show success modal
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
  const btnIds = ['btn-user', 'btn-user-desktop', 'btn-user-mobile'];
  btnIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.innerHTML = '<i class="bi bi-person-check-fill"></i>';
    btn.title = 'Tài khoản';
    if (btn.tagName === 'A') btn.setAttribute('href', 'my-account.html');
    btn.removeAttribute('data-action');
  });
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
        <div class="sidebar-section-title">${cat.title}</div>`;

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
              <div class="accordion-body">${item.children.map(c => `<a class="sidebar-link" href="#">${c}</a>`).join('')}</div>
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
    html += `<div class="sidebar-section"><div class="sidebar-section-title">CHỦ ĐỀ</div>`;
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
    html += `<div class="sidebar-section"><div class="sidebar-section-title">ĐỘ TUỔI</div><ul class="topic-list">`;
    AGE_GROUPS.forEach(a => { html += `<li><a href="#">${a}</a></li>`; });
    html += '</ul></div>';
  }

  if (typeof LANGUAGES !== 'undefined') {
    html += `<div class="sidebar-section"><div class="sidebar-section-title">THEO NGÔN NGỮ</div>`;
    LANGUAGES.forEach((l, i) => { html += `<a class="language-link ${i === 0 ? 'active' : ''}" href="#">${l}</a>`; });
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
  const el = document.getElementById('detail-sidebar-content');
  if (!el) return;
  el.innerHTML = createSidebarHTML({ compact: false, accordion: true });
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
      case 'views': return (b.views || 0) - (a.views || 0);
      case 'newest': return (b.id || 0) - (a.id || 0);
      case 'price': return (parseInt((a.price || '0').replace(/\D/g, ''), 10) || 0) - (parseInt((b.price || '0').replace(/\D/g, ''), 10) || 0);
      default: return (b.editions || 0) - (a.editions || 0);
    }
  });

  const countEl = document.getElementById('book-count');
  if (countEl) countEl.textContent = `(${books.length})`;

  const totalPages = Math.max(1, Math.ceil(books.length / BOOKS_PER_PAGE));
  if (currentPageIndex > totalPages) currentPageIndex = 1;

  const start = (currentPageIndex - 1) * BOOKS_PER_PAGE;
  const pageBooks = books.slice(start, start + BOOKS_PER_PAGE);

  grid.innerHTML = pageBooks.map(b => createBookCard(b)).join('');
  renderPagination(totalPages);
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
  const typeLabel = book.type === 'Audio' ? 'Audio' : 'Ebook';
  const typeTagSrc = normalizeImageUrl(book.type === 'Audio' ? 'assets/images/audio-tag.svg' : 'assets/images/ebook-tag.svg');

  const coverSrc = normalizeImageUrl(book.coverImage);
  validateImageUrl(book.coverImage);

  const cover = coverSrc
    ? `<img src="${coverSrc}" alt="${book.title}" class="book-cover" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const fallback = `<div class="book-cover-fallback" style="background:${book.coverColor || '#8B7355'};display:${coverSrc ? 'none' : 'flex'}"><span>${book.title}</span></div>`;

  const vipTagSrc = normalizeImageUrl('assets/images/tag-hoi-vien.svg');

  return `<div class="book-card" data-book-id="${book.id}">
    <div class="book-cover-wrapper">
      <div class="book-type-badge">
        <img src="${typeTagSrc}" alt="" class="book-type-tag-icon" loading="lazy">
        <span class="book-type-tag-text">${typeLabel}</span>
      </div>
      ${cover}${fallback}
      <div class="book-vip-badge"><img src="${vipTagSrc}" alt="Hội viên" class="vip-tag-img" loading="lazy"></div>
    </div>
    <div class="book-info"><div class="book-title">${book.title}</div></div>
  </div>`;
}

/** Renders pagination controls */
function renderPagination(totalPages = 1) {
  const list = document.getElementById('pagination-list');
  if (!list) return;
  const pages = Math.max(1, totalPages);
  const current = Math.min(currentPageIndex, pages);
  let pageNums = [];

  if (pages <= 5) {
    pageNums = Array.from({ length: pages }, (_, i) => i + 1);
  } else if (current <= 3) {
    pageNums = [1, 2, 3, 'dots', pages];
  } else if (current >= pages - 2) {
    pageNums = [1, 'dots', pages - 2, pages - 1, pages];
  } else {
    pageNums = [1, 'dots', current - 1, current, current + 1, 'dots', pages];
  }

  let h = '';
  h += `<li class="page-item ${current === 1 ? 'disabled' : ''}"><a class="page-link page-link-nav" href="#" data-page-action="first" aria-label="Trang đầu"><i class="bi bi-chevron-double-left"></i></a></li>`;
  h += `<li class="page-item ${current === 1 ? 'disabled' : ''}"><a class="page-link page-link-nav" href="#" data-page-action="prev" aria-label="Trang trước"><i class="bi bi-chevron-left"></i></a></li>`;

  pageNums.forEach(p => {
    if (p === 'dots') {
      h += `<li class="page-item disabled"><span class="page-link page-link-dots">...</span></li>`;
      return;
    }
    h += `<li class="page-item ${p === current ? 'active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
  });

  h += `<li class="page-item ${current === pages ? 'disabled' : ''}"><a class="page-link page-link-nav" href="#" data-page-action="next" aria-label="Trang sau"><i class="bi bi-chevron-right"></i></a></li>`;
  h += `<li class="page-item ${current === pages ? 'disabled' : ''}"><a class="page-link page-link-nav" href="#" data-page-action="last" aria-label="Trang cuối"><i class="bi bi-chevron-double-right"></i></a></li>`;
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
  const coverImg = document.getElementById('detail-cover-img');
  const coverLink = document.getElementById('detail-cover-link');
  const coverLoading = document.getElementById('detail-cover-loading');
  const coverTag = document.getElementById('detail-cover-tag');

  if (coverImg) {
    const coverSrc = normalizeImageUrl(book.coverImage);
    if (coverSrc) {
      coverImg.src = coverSrc;
      if (coverLink) {
        coverLink.href = coverSrc;
        coverLink.dataset.fancybox = 'gallery';
        coverLink.dataset.thumb = coverSrc;
        coverLink.removeAttribute('data-action');
      } else {
        coverImg.dataset.fancybox = 'gallery';
        coverImg.dataset.src = coverSrc;
        coverImg.dataset.thumb = coverSrc;
      }
      coverImg.style.cursor = "zoom-in";
      
      coverImg.classList.remove('hidden-init');
      if (coverLoading) coverLoading.style.display = 'none';
      coverImg.parentNode.style.background = 'transparent';
    } else {
      coverImg.classList.add('hidden-init');
      if (coverLoading) coverLoading.style.display = 'block';
      coverImg.parentNode.style.background = 'transparent';
    }
    if (coverTag) coverTag.style.display = 'block'; // Demo tag Hội Viên luôn show
  }

  // Thumbnails
  const thumbs = document.getElementById('detail-thumbs-list');
  if (thumbs && book.coverImage) {
    const coverSrc = normalizeImageUrl(book.coverImage);
    const tryIcon = normalizeImageUrl(book.type === 'Audio' ? 'assets/images/nghe-thu.svg' : 'assets/images/doc-thu.svg');
    const tryLabel = book.type === 'Audio' ? 'Nghe thử' : 'Đọc thử';
    const galleryImages = Array.isArray(book.galleryImages) && book.galleryImages.length
      ? book.galleryImages.map(normalizeImageUrl).filter(Boolean)
      : [coverSrc, coverSrc, coverSrc, coverSrc];
    const thumbsHtml = galleryImages.slice(0, 4).map((src, index) => `
      <a class="thumb-item ${index === 0 ? 'active' : ''}" href="${src}" data-fancybox="gallery" data-thumb="${src}" style="cursor:zoom-in">
        <img src="${src}" alt="" loading="lazy">
      </a>`).join('');

    thumbs.innerHTML = `
      ${thumbsHtml}
      <button type="button" class="thumb-action-box" data-action="open-gallery"><span>Xem thêm<br>hình ảnh</span></button>
      <button class="thumb-action-box light-mode" data-action="read-trial" data-url="${book.readTrialUrl || '#'}"><img src="${tryIcon}" alt="${tryLabel}" loading="lazy"><span>${tryLabel}</span></button>`;
  }

  // Text fields
  setText('detail-crumb-title', book.title);
  setText('detail-crumb-cat', (book.categories || [])[0] || 'Ebook');
  setText('detail-book-title', `[${book.type || 'Ebook'}] ${book.title}`);
  setText('detail-subtitle', book.genre || 'Subtitle title');
  setText('detail-book-rating', book.rating || '4.5');
  setText('detail-book-views', (book.views || 0).toLocaleString());
  setText('detail-book-editions', (book.editions || 0).toLocaleString());
  const packageEl = document.getElementById('detail-package');
  if (packageEl) packageEl.innerHTML = `<img src="${normalizeImageUrl('assets/images/tag-hoi-vien.svg')}" alt="Hội Viên" style="height: 32px; vertical-align: middle;" loading="lazy">`;

  // Categories
  const catLink = document.getElementById('detail-cat-link');
  if (catLink) {
    const cats = (book.categories || ['Sách Thiếu nhi', 'Minh họa'])
      .map(c => (c || '').trim())
      .filter(Boolean);
    catLink.innerHTML = cats
      .map(c => `<a href="#" class="detail-category-link">${c}</a>`)
      .join('<span class="detail-category-sep">; </span>');
  }

  // Format selector (normalized image paths)
  const fmtBox = document.getElementById('detail-format-selector');
  if (fmtBox) {
    fmtBox.innerHTML = [
      { icon: 'assets/images/ebook.svg', label: 'Ebook', active: book.type === 'Ebook' },
      { icon: 'assets/images/audiobook.svg', label: 'Audio', active: book.type === 'Audio' },
      { icon: 'assets/images/multi-books.svg', label: 'Sách<br>tương tác', active: false }
    ].map(f => `<div class="format-box ${f.active ? 'active' : ''}">
        <img src="${normalizeImageUrl(f.icon)}" alt="${f.label}" loading="lazy">
        <span>${f.label}</span>
    </div>`).join('');
  }

  // Description with toggle removed (as requested by user)
  const descEl = document.getElementById('detail-book-desc');
  if (descEl) {
    const longDesc = `
      <p>Là một cuốn sách hay không chỉ về tình mẫu tử thiêng liêng mà còn bởi những kỹ năng nuôi dạy con khôn khéo, tuyệt vời mà nữ tác giả Dương Vãn mang tới cho độc giả.</p>
      <p>Một cô thợ may trở thành sinh viên đại học, đi du học ở Anh, là giảng viên của một trường đại học, là thạc sĩ rồi giáo sư, trở thành chủ tịch hội đồng quản trị của một trong những học viện nổi tiếng...</p>
      <p>Một cậu bé thông minh, ham đọc sách từ nhỏ, luôn vui vẻ, say mê khám phá, là học sinh giỏi, trở thành sinh viên rồi tiến sĩ của trường Cambridge... Đó chính là quá trình đồng hành cùng con trai của Dương Vãn.</p>
      <p>Việc kiên trì quan điểm giáo dục tố chất, giáo dục vui vẻ đã giúp người mẹ này bồi dưỡng nên một tiến sĩ Cambridge vui vẻ, lương thiện, toàn diện. Đặc biệt là khi con trai trưởng thành thì người mẹ cũng tỏa sáng.</p>
      <p>Mẹ luôn đồng hành cùng con không chỉ là lý luận giáo dục tố chất gia đình của một chuyên gia giáo dục mà còn là sự tổng kết kinh nghiệm dạy con của một người mẹ yêu con một cách khoa học.</p>
    `;
    descEl.innerHTML = `<div class="desc-content"><strong>${book.title}</strong><br><br>${longDesc}</div>`;
  }
  
  // TOC Demo as requested
  const tocEl = document.getElementById('detail-book-toc');
  if (tocEl) {
     tocEl.innerHTML = `
      <table class="table table-borderless toc-table mb-0" style="color: var(--text-dark);">
        <tbody>
          <tr><td style="width: 80px; font-weight:600; padding-left:0;">Phần 1:</td><td style="font-weight:600;">Khởi đầu hành trình</td></tr>
          <tr><td style="padding-left:0;"></td><td>Chương 1: Khám phá bản thân</td></tr>
          <tr><td style="padding-left:0;"></td><td>Chương 2: Xây dựng nền tảng</td></tr>
          <tr><td style="width: 80px; font-weight:600; padding-left:0;">Phần 2:</td><td style="font-weight:600;">Vượt qua thử thách</td></tr>
          <tr><td style="padding-left:0;"></td><td>Chương 3: Đối mặt với khó khăn</td></tr>
          <tr><td style="padding-left:0;"></td><td>Chương 4: Trưởng thành</td></tr>
        </tbody>
      </table>
     `;
  }

  // Author
  setText('detail-author-name', book.author);
  const avatarEl = document.getElementById('author-avatar');
  if (avatarEl) avatarEl.textContent = (book.author || 'A')[0];

  // Pub info
  setText('pub-pages', `${book.pages || '—'} trang`);
  setText('pub-type', book.type || 'Ebook');

  if (typeof prepareReaderPages === 'function') prepareReaderPages();
}

/**
 * Prepares the HTML-based reader pages (fallback when epub.js is not available).
 * Uses SAMPLE_BOOK_CONTENT to split content into pageable chunks.
 */
function prepareReaderPages() {
  const readerContent = document.getElementById('reader-content');
  if (!readerContent) return;
  if (typeof SAMPLE_BOOK_CONTENT === 'undefined') return;
  readerContent.innerHTML = SAMPLE_BOOK_CONTENT;
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
  el.innerHTML = items.map(b => createBookCard(b)).join('');
}

/**
 * Renders suggested books in a horizontal scroll.
 * @param {Object} book - Current book to exclude from suggestions
 */
function renderSuggestedBooks(book) {
  const el = document.getElementById('suggested-books-grid');
  if (!el) return;
  const items = BOOKS_DATA.filter(b => b.id !== book.id).slice(0, 10);
  el.innerHTML = items.map(b => createBookCard(b)).join('');
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
    try { epubBook.destroy(); } catch (e) { }
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
    try { epubBook.destroy(); } catch (e) { }
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

    // Login button (Step 2)
    if (target.closest('#btn-login')) {
      handleLogin();
      return;
    }

    // Go Library button (Step 4)
    if (target.closest('#btn-go-library')) {
      handleGoLibrary();
      return;
    }

    // Toggle Mobile Sidebar
    const btnMenu = target.closest('#btn-mobile-menu-btn');
    if (btnMenu) {
      syncMobileSidebarOffset();
      const sidebar = document.getElementById('sidebar-content');
      const overlay = document.getElementById('sidebar-overlay');
      if (sidebar) sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
      document.body.classList.toggle('sidebar-open');

      const icon = btnMenu.querySelector('i');
      if (icon) {
        if (document.body.classList.contains('sidebar-open')) {
          icon.className = 'bi bi-x-lg';
        } else {
          icon.className = 'bi bi-list';
        }
      }
      return;
    }

    // Close Mobile Sidebar if clicking outside OR clicking the overlay
    const currentSidebar = document.getElementById('sidebar-content');
    if (currentSidebar && currentSidebar.classList.contains('active')) {
      if (!target.closest('#sidebar-content') && !target.closest('#btn-mobile-menu-btn') || target.closest('#sidebar-overlay')) {
        currentSidebar.classList.remove('active');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        const iconBtn = document.querySelector('#btn-mobile-menu-btn i');
        if (iconBtn) iconBtn.className = 'bi bi-list';
      }
    }

    // Header logo → homepage
    const logoLink = target.closest('.header-logo');
    if (logoLink) {
      if (!document.getElementById('page-homepage')) return;
      e.preventDefault();
      navigateTo('homepage');
      return;
    }

    // User avatar → login / my-account
    const userBtn = target.closest('#btn-user, #btn-user-desktop, #btn-user-mobile');
    if (userBtn) {
      const isLoggedIn = localStorage.getItem('benbooks_loggedIn') === 'true';
      if (!isLoggedIn) {
        if (document.getElementById('page-homepage')) {
          e.preventDefault();
          navigateTo('login');
        }
        return;
      }
      e.preventDefault();
      window.location.href = 'my-account.html';
      return;
    }

    // Gói Cước header
    if (target.closest('#btn-goicuoc-header')) {
      if (document.getElementById('page-homepage')) e.preventDefault();
      window.location.href = 'goi-cuoc.html';
      return;
    }

    // Filter badges (delegation)
    const badge = target.closest('.filter-badge');
    if (badge) {
      document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      currentFilter = badge.dataset.filter;
      currentPageIndex = 1;
      renderBooks(currentFilter);
      return;
    }

    // Sort buttons (delegation)
    const sortBtn = target.closest('.sort-btn');
    if (sortBtn) {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      sortBtn.classList.add('active');
      currentSort = sortBtn.dataset.sort || 'popular';
      currentPageIndex = 1;
      renderBooks(currentFilter);
      return;
    }

    // Format box selection in book detail page
    const formatBox = target.closest('.format-box');
    if (formatBox) {
      document.querySelectorAll('.format-box').forEach(b => b.classList.remove('active'));
      formatBox.classList.add('active');

      const formatLabel = formatBox.textContent.trim();
      const readBtn = document.getElementById('btn-read-now');
      if (readBtn) {
        if (formatLabel.includes('Audio')) readBtn.textContent = 'Nghe ngay';
        else if (formatLabel.includes('Sách in')) readBtn.textContent = 'Mua ngay';
        else readBtn.textContent = 'Đọc ngay';
      }
      return;
    }

    // Book cards (delegation — works for grid AND scroll sections)
    const card = target.closest('.book-card');
    if (card) {
      const id = parseInt(card.dataset.bookId);
      window.location.href = `details.html?id=${id}`;
      return;
    }

    // Image Gallery Open
    const thumbImg = target.closest('.thumb-item img, .detail-cover-box img');
    if (thumbImg) {
      const galleryOverlay = document.getElementById('image-gallery-overlay');
      const galleryImg = document.getElementById('gallery-main-img');
      if (galleryOverlay && galleryImg) {
        galleryImg.src = thumbImg.src;
        galleryOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      return;
    }

    // Image Gallery Close
    if (target.closest('#btn-gallery-close') || target.classList.contains('gallery-overlay')) {
      const galleryOverlay = document.getElementById('image-gallery-overlay');
      if (galleryOverlay) {
        galleryOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
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
      if (epubRendition) epubRendition.themes.select(theme);
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
      if (epubRendition) epubRendition.themes.font(fontObj[val] || fontObj['sans-serif']);
      localStorage.setItem('epubFont', val);
      return;
    }

    // Settings: Line Height
    if (target.closest('.setting-btn[data-lineheight]')) {
      const btn = target.closest('.setting-btn[data-lineheight]');
      const lh = btn.dataset.lineheight;
      document.querySelectorAll('.setting-btn[data-lineheight]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (epubRendition) epubRendition.themes.override('line-height', lh + ' !important');
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

    // Mobile floating support toggle
    if (target.closest('#btn-floating-support')) {
      const wrap = target.closest('.floating-actions');
      if (wrap) {
        const expanded = !wrap.classList.contains('expanded');
        wrap.classList.toggle('expanded', expanded);
        const supportIcon = wrap.querySelector('#btn-floating-support i');
        if (supportIcon) supportIcon.className = expanded ? 'bi bi-x-lg' : 'bi bi-headset';
      }
      return;
    }

    // Benito floating button: open main site
    if (target.closest('.floating-btn.benito')) {
      window.open('https://sachbanquyen.com.vn', '_blank');
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

    // Open gallery from thumb action button
    const openGallery = target.closest('[data-action="open-gallery"], #detail-cover-img');
    if (openGallery) {
      const firstThumb = document.querySelector('#detail-thumbs-list .thumb-item');
      if (firstThumb) firstThumb.click();
      return;
    }

    // Keep selected thumb state in detail view
    const thumbItem = target.closest('#detail-thumbs-list .thumb-item');
    if (thumbItem) {
      document.querySelectorAll('#detail-thumbs-list .thumb-item').forEach(el => el.classList.remove('active'));
      thumbItem.classList.add('active');
      return;
    }

    // Carousel Navigation
    const carouselNav = target.closest('.btn-carousel-nav');
    if (carouselNav) {
      e.preventDefault();
      const wrap = carouselNav.closest('.suggested-carousel-wrap, .related-section');
      if (wrap) {
        const scrollContainer = wrap.querySelector('.books-scroll-wrap, .books-scroll');
        if (scrollContainer) {
          const scrollAmount = scrollContainer.clientWidth * 0.8;
          if (carouselNav.classList.contains('prev')) {
            scrollContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          } else {
            scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          }
        }
      }
      return;
    }

    // Pagination link
    const pageLink = target.closest('.page-link');
    if (pageLink) {
      e.preventDefault();
      if (pageLink.closest('.page-item')?.classList.contains('disabled')) return;

      const action = pageLink.dataset.pageAction;
      const page = parseInt(pageLink.dataset.page || '', 10);

      let totalItems = BOOKS_DATA?.length || 0;
      if (currentFilter === 'Ebook') totalItems = (BOOKS_DATA || []).filter(b => b.type === 'Ebook').length;
      else if (currentFilter === 'Audio') totalItems = (BOOKS_DATA || []).filter(b => b.type === 'Audio').length;
      const totalPages = Math.max(1, Math.ceil(totalItems / BOOKS_PER_PAGE));

      if (action === 'first') currentPageIndex = 1;
      else if (action === 'prev') currentPageIndex = Math.max(1, currentPageIndex - 1);
      else if (action === 'next') currentPageIndex = Math.min(totalPages, currentPageIndex + 1);
      else if (action === 'last') currentPageIndex = totalPages;
      else if (!Number.isNaN(page)) currentPageIndex = page;

      renderBooks(currentFilter);
      const booksGrid = document.getElementById('books-grid');
      if (booksGrid) {
        const headerOffset = 90;
        const top = booksGrid.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      return;
    }

    // Click outside floating area on mobile => collapse support menu
    if (!target.closest('.floating-actions')) {
      document.querySelectorAll('.floating-actions.expanded').forEach((el) => {
        el.classList.remove('expanded');
        const supportIcon = el.querySelector('#btn-floating-support i');
        if (supportIcon) supportIcon.className = 'bi bi-headset';
      });
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
