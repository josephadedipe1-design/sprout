'use client';

import { useRef, useState } from 'react';
import { Bold, Italic, Link as LinkIcon, Underline, X, Loader2 } from 'lucide-react';

function insertWrappedText(value: string, start: number, end: number, marker: string) {
  const selected = value.substring(start, end);
  const text = selected || 'text';
  return {
    value: value.substring(0, start) + marker + text + marker + value.substring(end),
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + text.length,
  };
}

interface EditTextModalProps {
  title: string;
  initialText: string;
  saving: boolean;
  onClose: () => void;
  onSave: (body: string) => void;
}

export default function EditTextModal({ title, initialText, saving, onClose, onSave }: EditTextModalProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(marker: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = insertWrappedText(text, textarea.selectionStart, textarea.selectionEnd, marker);
    setText(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  function insertLink() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.substring(start, end);
    const url = window.prompt('Enter the URL (https://…)');
    if (!url?.trim()) return;
    const linkText = selected || 'link text';
    const replacement = `[${linkText}](${url.trim()})`;
    setText(text.substring(0, start) + replacement + text.substring(end));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + linkText.length);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(42,31,24,0.45)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'white' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>{title}</h2>
          <button onClick={onClose} disabled={saving} style={{ color: '#9a8070' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-1 p-1.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
            <button type="button" onClick={() => wrapSelection('**')} className="p-2 rounded-lg hover:bg-white" title="Bold" style={{ color: '#3a2820' }}><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => wrapSelection('_')} className="p-2 rounded-lg hover:bg-white" title="Italic" style={{ color: '#3a2820' }}><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => wrapSelection('++')} className="p-2 rounded-lg hover:bg-white" title="Underline" style={{ color: '#3a2820' }}><Underline className="w-4 h-4" /></button>
            <button type="button" onClick={insertLink} className="p-2 rounded-lg hover:bg-white" title="Insert link" style={{ color: '#3a2820' }}><LinkIcon className="w-4 h-4" /></button>
          </div>
          <textarea
            ref={textareaRef}
            autoFocus
            rows={7}
            maxLength={500}
            className="input-sprout w-full resize-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ lineHeight: 1.6 }}
          />
          <p className="text-xs" style={{ color: '#c4a090' }}>{text.length}/500 · Use **bold**, _italic_, ++underline++, [link text](url)</p>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: 'var(--border-color)', color: '#7a6055' }}>Cancel</button>
            <button onClick={() => onSave(text.trim())} disabled={!text.trim() || saving} className="btn-brand flex-1 text-sm flex items-center justify-center gap-2" style={{ opacity: text.trim() && !saving ? 1 : 0.5 }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
