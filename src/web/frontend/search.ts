import { getCy, panToNode, pulseNode } from './graph.js';

let matches: string[] = [];
let currentIndex = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function findMatches(query: string): string[] {
  const cy = getCy();
  if (!cy || !query.trim()) return [];

  const q = query.toLowerCase().trim();
  const results: string[] = [];

  cy.nodes().forEach((node) => {
    if (!node.visible()) return;
    const id = (node.id() || '').toLowerCase();
    const label = (node.data('label') || '').toLowerCase();
    // Match by id prefix or title substring
    if (id.startsWith(q) || label.includes(q)) {
      results.push(node.id());
    }
  });

  return results;
}

function navigateToMatch(index: number): void {
  if (matches.length === 0) return;
  currentIndex = ((index % matches.length) + matches.length) % matches.length;
  const nodeId = matches[currentIndex];
  panToNode(nodeId);
  pulseNode(nodeId);
  updateCounter();
}

function updateCounter(): void {
  const counter = document.getElementById('search-counter');
  if (!counter) return;
  if (matches.length === 0) {
    counter.textContent = '';
  } else {
    counter.textContent = `${currentIndex + 1}/${matches.length}`;
  }
}

export function renderSearchBar(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.cssText = 'display:flex;align-items:center;gap:4px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search nodes...';
  input.id = 'search-input';
  input.style.cssText = `
    padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;
    font-size: 12px; width: 160px; outline: none;
  `;

  const counter = document.createElement('span');
  counter.id = 'search-counter';
  counter.style.cssText = 'font-size: 11px; color: #888; min-width: 40px;';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '◀';
  prevBtn.title = 'Previous match';
  prevBtn.style.cssText = 'border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;padding:2px 6px;font-size:11px;';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '▶';
  nextBtn.title = 'Next match';
  nextBtn.style.cssText = prevBtn.style.cssText;

  const clearBtn = document.createElement('button');
  clearBtn.textContent = '✕';
  clearBtn.title = 'Clear search';
  clearBtn.style.cssText = 'border:none;background:none;cursor:pointer;font-size:13px;color:#999;';

  input.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value;
      matches = findMatches(query);
      currentIndex = 0;
      updateCounter();
      if (matches.length > 0) {
        navigateToMatch(0);
      }
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) navigateToMatch(currentIndex - 1);
      else navigateToMatch(currentIndex + 1);
    }
    if (e.key === 'Escape') {
      input.value = '';
      matches = [];
      currentIndex = 0;
      updateCounter();
    }
  });

  prevBtn.addEventListener('click', () => navigateToMatch(currentIndex - 1));
  nextBtn.addEventListener('click', () => navigateToMatch(currentIndex + 1));
  clearBtn.addEventListener('click', () => {
    input.value = '';
    matches = [];
    currentIndex = 0;
    updateCounter();
  });

  container.appendChild(input);
  container.appendChild(counter);
  container.appendChild(prevBtn);
  container.appendChild(nextBtn);
  container.appendChild(clearBtn);
}
