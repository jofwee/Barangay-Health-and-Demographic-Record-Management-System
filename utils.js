// ──────────────────────────────────────────────────────────
// Shared utilities — include this script before page-specific logic.
// ──────────────────────────────────────────────────────────

/**
 * Escape a string for safe insertion into HTML.
 * Returns '' for null/undefined.
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Alias used in some pages
const escHTML = escapeHTML;
