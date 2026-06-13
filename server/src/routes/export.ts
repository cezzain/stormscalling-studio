import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { db } from '../db.js';
import { DATA_DIR, IMAGES_DIR, DB_PATH } from '../config.js';
import { htmlToMarkdown } from '../markdown.js';

export const exportRouter = Router();

interface PageRow {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  body: string;
}

function collectNode(id: string): { title: string; sections: Array<{ title: string; html: string }> } | null {
  const node = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | undefined;
  if (!node) return null;
  const sections: Array<{ title: string; html: string }> = [];
  const walk = (n: PageRow) => {
    if (n.body && n.body.trim()) sections.push({ title: n.title, html: n.body });
    const kids = db.prepare('SELECT * FROM pages WHERE parent_id = ? ORDER BY position').all(n.id) as PageRow[];
    for (const k of kids) walk(k);
  };
  walk(node);
  if (!sections.length) sections.push({ title: node.title, html: node.body });
  return { title: node.title, sections };
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
}

// ---- Markdown ----
exportRouter.get('/page/:id', (req, res) => {
  const format = String(req.query.format ?? 'md');
  const node = collectNode(req.params.id);
  if (!node) return res.status(404).json({ error: 'not_found' });

  if (format === 'md') {
    const md = `# ${node.title}\n\n${node.sections
      .map((s) => (node.sections.length > 1 ? `## ${s.title}\n\n${htmlToMarkdown(s.html)}` : htmlToMarkdown(s.html)))
      .join('\n\n')}\n`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(node.title)}.md"`);
    return res.send(md);
  }

  if (format === 'docx') {
    const children: Paragraph[] = [
      new Paragraph({ text: node.title, heading: HeadingLevel.TITLE }),
    ];
    for (const s of node.sections) {
      if (node.sections.length > 1) children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }));
      children.push(...htmlToDocxParagraphs(s.html));
    }
    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc).then((buf) => {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${slug(node.title)}.docx"`);
      res.send(buf);
    });
  }

  res.status(400).json({ error: 'unknown_format' });
});

// ---- Codex -> Markdown zip ----
exportRouter.get('/codex', (_req, res) => {
  const entities = db.prepare('SELECT type, name, aliases, body FROM entities ORDER BY type, name').all() as Array<{
    type: string;
    name: string;
    aliases: string;
    body: string;
  }>;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="codex.zip"');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  for (const e of entities) {
    let aliases: string[] = [];
    try {
      aliases = JSON.parse(e.aliases);
    } catch {
      /* ignore */
    }
    const md = `# ${e.name}\n\n*${e.type}*${aliases.length ? `\n\nAliases: ${aliases.join(', ')}` : ''}\n\n${htmlToMarkdown(e.body)}\n`;
    archive.append(md, { name: `${e.type}/${slug(e.name)}.md` });
  }
  archive.finalize();
});

// ---- Full backup (db + images) ----
exportRouter.get('/backup', (_req, res) => {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="storms-calling-backup.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  if (fs.existsSync(DB_PATH)) archive.file(DB_PATH, { name: 'storms-calling.db' });
  // include WAL/SHM if present so the snapshot is consistent
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) archive.file(p, { name: `storms-calling.db${ext}` });
  }
  if (fs.existsSync(IMAGES_DIR)) archive.directory(IMAGES_DIR, 'images');
  archive.finalize();
});

// ---------------------------------------------------------------------------
// Minimal HTML -> docx paragraph conversion (headings, lists, blockquote,
// hr, and inline bold/italic). Good enough for manuscript export.
// ---------------------------------------------------------------------------
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const md = htmlToMarkdown(html);
  const out: Paragraph[] = [];
  for (const rawLine of md.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) {
      continue;
    }
    if (/^### /.test(line)) {
      out.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (/^## /.test(line)) {
      out.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (/^# /.test(line)) {
      out.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (/^> /.test(line)) {
      out.push(new Paragraph({ children: parseInline(line.slice(2)), style: 'IntenseQuote' }));
    } else if (/^[-*] /.test(line)) {
      out.push(new Paragraph({ children: parseInline(line.slice(2)), bullet: { level: 0 } }));
    } else if (/^\d+\. /.test(line)) {
      out.push(new Paragraph({ children: parseInline(line.replace(/^\d+\.\s/, '')), numbering: { reference: 'num', level: 0 } as any }));
    } else if (/^---+$/.test(line.trim())) {
      out.push(new Paragraph({ text: '' }));
    } else {
      out.push(new Paragraph({ children: parseInline(line) }));
    }
  }
  return out.length ? out : [new Paragraph({ text: '' })];
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
    if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], bold: true }));
    else if (m[3] !== undefined) runs.push(new TextRun({ text: m[3], italics: true }));
    else if (m[4] !== undefined) runs.push(new TextRun({ text: m[4], italics: true }));
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)));
  return runs.length ? runs : [new TextRun(text)];
}
