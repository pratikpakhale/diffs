import './style.css'
import { diffLines, diffWords } from 'diff'

// ── State ──

let viewMode = 'split'

const SAMPLE_ORIGINAL = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["Alice", "Bob", "Charlie"];

for (let i = 0; i < users.length; i++) {
  greet(users[i]);
}`

const SAMPLE_MODIFIED = `function greet(name, greeting = "Hello") {
  console.log(\`\${greeting}, \${name}!\`);
  return { success: true, name };
}

const users = ["Alice", "Bob", "Charlie", "Diana"];

for (const user of users) {
  greet(user);
}

export default greet;`

// ── Elements ──

const originalEl = document.getElementById('original')
const modifiedEl = document.getElementById('modified')
const diffOutput = document.getElementById('diffOutput')
const statsEl = document.getElementById('diffStats')

// ── Persistence ──

function save() {
  localStorage.setItem('diff-original', originalEl.value)
  localStorage.setItem('diff-modified', modifiedEl.value)
}

function load() {
  const original = localStorage.getItem('diff-original')
  const modified = localStorage.getItem('diff-modified')

  if (original !== null && modified !== null) {
    originalEl.value = original
    modifiedEl.value = modified
  } else {
    originalEl.value = SAMPLE_ORIGINAL
    modifiedEl.value = SAMPLE_MODIFIED
  }
}

// ── Theme ──

function initTheme() {
  const saved = localStorage.getItem('diff-theme')
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('diff-theme', next)
}

// ── View Toggle ──

document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    viewMode = btn.dataset.view
    compare()
  })
})

// ── Actions ──

document.getElementById('clearBtn').addEventListener('click', () => {
  originalEl.value = ''
  modifiedEl.value = ''
  save()
  compare()
})

document.getElementById('swapBtn').addEventListener('click', () => {
  const temp = originalEl.value
  originalEl.value = modifiedEl.value
  modifiedEl.value = temp
  save()
  compare()
})

document.getElementById('themeToggle').addEventListener('click', toggleTheme)

// Auto-compare on input
originalEl.addEventListener('input', () => { save(); compare() })
modifiedEl.addEventListener('input', () => { save(); compare() })

// ── Diff Engine ──

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightInlineChanges(oldLine, newLine) {
  const wordDiff = diffWords(oldLine, newLine)
  let oldHtml = ''
  let newHtml = ''

  for (const part of wordDiff) {
    const escaped = escapeHtml(part.value)
    if (part.added) {
      newHtml += `<span class="highlight">${escaped}</span>`
    } else if (part.removed) {
      oldHtml += `<span class="highlight">${escaped}</span>`
    } else {
      oldHtml += escaped
      newHtml += escaped
    }
  }

  return { oldHtml, newHtml }
}

function compare() {
  const original = originalEl.value
  const modified = modifiedEl.value

  if (!original && !modified) {
    diffOutput.innerHTML = '<div class="diff-placeholder">Start typing to see the diff</div>'
    statsEl.innerHTML = ''
    return
  }

  const changes = diffLines(original, modified)

  let additions = 0
  let deletions = 0

  for (const part of changes) {
    const count = part.count || 0
    if (part.added) additions += count
    else if (part.removed) deletions += count
  }

  statsEl.innerHTML = `
    <span class="stat-add">+${additions}</span>
    <span class="stat-del">-${deletions}</span>
  `

  if (viewMode === 'split') {
    renderSplit(changes)
  } else {
    renderUnified(changes)
  }
}

function renderSplit(changes) {
  let leftLines = []
  let rightLines = []

  let leftNum = 0
  let rightNum = 0

  let i = 0
  while (i < changes.length) {
    const change = changes[i]
    const lines = change.value.replace(/\n$/, '').split('\n')

    if (!change.added && !change.removed) {
      for (const line of lines) {
        leftNum++
        rightNum++
        leftLines.push({ num: leftNum, content: escapeHtml(line), type: '' })
        rightLines.push({ num: rightNum, content: escapeHtml(line), type: '' })
      }
      i++
    } else if (change.removed && i + 1 < changes.length && changes[i + 1].added) {
      const oldLines = lines
      const newLines = changes[i + 1].value.replace(/\n$/, '').split('\n')
      const maxLen = Math.max(oldLines.length, newLines.length)

      for (let j = 0; j < maxLen; j++) {
        const oldLine = j < oldLines.length ? oldLines[j] : null
        const newLine = j < newLines.length ? newLines[j] : null

        if (oldLine !== null && newLine !== null) {
          const { oldHtml, newHtml } = highlightInlineChanges(oldLine, newLine)
          leftNum++
          rightNum++
          leftLines.push({ num: leftNum, content: oldHtml, type: 'deletion' })
          rightLines.push({ num: rightNum, content: newHtml, type: 'addition' })
        } else if (oldLine !== null) {
          leftNum++
          leftLines.push({ num: leftNum, content: escapeHtml(oldLine), type: 'deletion' })
          rightLines.push({ num: '', content: '', type: '' })
        } else {
          rightNum++
          leftLines.push({ num: '', content: '', type: '' })
          rightLines.push({ num: rightNum, content: escapeHtml(newLine), type: 'addition' })
        }
      }
      i += 2
    } else if (change.removed) {
      for (const line of lines) {
        leftNum++
        leftLines.push({ num: leftNum, content: escapeHtml(line), type: 'deletion' })
        rightLines.push({ num: '', content: '', type: '' })
      }
      i++
    } else {
      for (const line of lines) {
        rightNum++
        leftLines.push({ num: '', content: '', type: '' })
        rightLines.push({ num: rightNum, content: escapeHtml(line), type: 'addition' })
      }
      i++
    }
  }

  const renderCol = (lines) =>
    lines.map(l =>
      `<div class="diff-line ${l.type}">` +
        `<div class="diff-line-num">${l.num}</div>` +
        `<div class="diff-line-content">${l.content}</div>` +
      `</div>`
    ).join('')

  diffOutput.innerHTML = `
    <div class="diff-split">
      <div class="diff-split-col">${renderCol(leftLines)}</div>
      <div class="diff-split-col">${renderCol(rightLines)}</div>
    </div>
  `

  syncScroll()
}

function renderUnified(changes) {
  let html = '<div class="diff-unified">'
  let oldNum = 0
  let newNum = 0

  let i = 0
  while (i < changes.length) {
    const change = changes[i]
    const lines = change.value.replace(/\n$/, '').split('\n')

    if (!change.added && !change.removed) {
      for (const line of lines) {
        oldNum++
        newNum++
        html += `<div class="diff-line">` +
          `<div class="diff-line-num">${oldNum}</div>` +
          `<div class="diff-line-num">${newNum}</div>` +
          `<div class="diff-line-content">${escapeHtml(line)}</div>` +
          `</div>`
      }
      i++
    } else if (change.removed && i + 1 < changes.length && changes[i + 1].added) {
      const oldLines = lines
      const newLines = changes[i + 1].value.replace(/\n$/, '').split('\n')

      for (const line of oldLines) {
        oldNum++
        const { oldHtml } = highlightInlineChanges(line, newLines[0] || '')
        html += `<div class="diff-line deletion">` +
          `<div class="diff-line-num">${oldNum}</div>` +
          `<div class="diff-line-num"></div>` +
          `<div class="diff-line-content">${oldHtml}</div>` +
          `</div>`
      }
      for (const line of newLines) {
        newNum++
        const { newHtml } = highlightInlineChanges(oldLines[0] || '', line)
        html += `<div class="diff-line addition">` +
          `<div class="diff-line-num"></div>` +
          `<div class="diff-line-num">${newNum}</div>` +
          `<div class="diff-line-content">${newHtml}</div>` +
          `</div>`
      }
      i += 2
    } else if (change.removed) {
      for (const line of lines) {
        oldNum++
        html += `<div class="diff-line deletion">` +
          `<div class="diff-line-num">${oldNum}</div>` +
          `<div class="diff-line-num"></div>` +
          `<div class="diff-line-content">${escapeHtml(line)}</div>` +
          `</div>`
      }
      i++
    } else {
      for (const line of lines) {
        newNum++
        html += `<div class="diff-line addition">` +
          `<div class="diff-line-num"></div>` +
          `<div class="diff-line-num">${newNum}</div>` +
          `<div class="diff-line-content">${escapeHtml(line)}</div>` +
          `</div>`
      }
      i++
    }
  }

  html += '</div>'
  diffOutput.innerHTML = html
}

function syncScroll() {
  const cols = diffOutput.querySelectorAll('.diff-split-col')
  if (cols.length !== 2) return

  let syncing = false
  cols.forEach((col, idx) => {
    col.addEventListener('scroll', () => {
      if (syncing) return
      syncing = true
      const other = cols[1 - idx]
      other.scrollTop = col.scrollTop
      syncing = false
    })
  })
}

// ── Init ──

initTheme()
load()
compare()
