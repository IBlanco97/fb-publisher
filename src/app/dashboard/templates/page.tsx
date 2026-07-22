'use client';

import { useEffect, useState } from 'react';
import type { AdTemplate, TemplateVariable } from '@/lib/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<AdTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewTemplate, setPreviewTemplate] = useState<AdTemplate | null>(null);
  const [form, setForm] = useState({
    name: '',
    body: '',
    variables: [] as TemplateVariable[],
    tags: [] as string[],
  });
  const [newTag, setNewTag] = useState('');
  const [valuesText, setValuesText] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    const res = await fetch('/api/templates');
    setTemplates(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, body: form.body };
    if (editingId) {
      await fetch(`/api/templates/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    fetchTemplates();
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  }

  async function handlePreview(template: AdTemplate, index = 0) {
    setPreviewTemplate(template);
    setPreviewIndex(index);
    const res = await fetch('/api/templates/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, rotationIndex: index }),
    });
    const data = await res.json();
    setPreview(data.text);
  }

  function addVariable() {
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { name: '', type: 'text', values: [], format: '' }],
    }));
  }

  function updateVariable(index: number, field: string, value: any) {
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  }

  function removeVariable(index: number) {
    setForm((f) => ({
      ...f,
      variables: f.variables.filter((_, i) => i !== index),
    }));
    setValuesText((t) => {
      const next: Record<number, string> = {};
      Object.entries(t).forEach(([i, text]) => {
        const idx = Number(i);
        if (idx < index) next[idx] = text;
        else if (idx > index) next[idx - 1] = text;
      });
      return next;
    });
  }

  function addTag() {
    if (newTag.trim()) {
      setForm((f) => ({ ...f, tags: [...f.tags, newTag.trim()] }));
      setNewTag('');
    }
  }

  function startEdit(template: AdTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      body: template.body,
      variables: template.variables,
      tags: template.tags || [],
    });
    setValuesText({});
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setPreview(null);
    setPreviewTemplate(null);
    setForm({ name: '', body: '', variables: [], tags: [] });
    setValuesText({});
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Plantillas de anuncios</h2>
        <button
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nueva plantilla'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Oferta productos tecnología"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Contenido de la plantilla <span className="text-gray-600">(usa {'{{variable}}'} para insertar variables)</span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 min-h-[120px] font-mono"
              placeholder={`🔥 OFERTA ESPECIAL 🔥\n\n{{producto}} disponible en {{ubicacion}}\nPrecio: {{precio}}\n\n📱 Contacto: {{telefono}}`}
              required
            />
          </div>

          {/* Variables */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">Variables</label>
              <button type="button" onClick={addVariable} className="text-xs text-blue-400 hover:text-blue-300">
                + Agregar variable
              </button>
            </div>
            {form.variables.map((v, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 mb-2">
                <input
                  value={v.name}
                  onChange={(e) => updateVariable(i, 'name', e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  placeholder="nombre"
                />
                <select
                  value={v.type}
                  onChange={(e) => updateVariable(i, 'type', e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="price">Precio</option>
                  <option value="list">Lista</option>
                </select>
                <input
                  value={valuesText[i] ?? v.values.join(', ')}
                  onChange={(e) => {
                    const text = e.target.value;
                    setValuesText((t) => ({ ...t, [i]: text }));
                    updateVariable(i, 'values', text.split(',').map((s) => s.trim()).filter(Boolean));
                  }}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                  placeholder="valor1, valor2, valor3"
                />
                <button type="button" onClick={() => removeVariable(i)} className="text-red-400 hover:text-red-300 text-sm">
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Tags</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {form.tags.map((tag, i) => (
                <span key={i} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))} className="text-gray-500 hover:text-red-400">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm flex-1"
                placeholder="Agregar tag..."
              />
              <button type="button" onClick={addTag} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                +
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              {editingId ? 'Actualizar' : 'Crear plantilla'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-gray-900 rounded-xl border border-blue-500/30 p-6 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-blue-400">Vista previa (rotación #{previewIndex})</h3>
            <div className="flex gap-2">
              <button
                onClick={() => previewTemplate && handlePreview(previewTemplate, Math.max(0, previewIndex - 1))}
                className="px-2 py-1 bg-gray-700 rounded text-xs"
              >
                ← Anterior
              </button>
              <button
                onClick={() => previewTemplate && handlePreview(previewTemplate, previewIndex + 1)}
                className="px-2 py-1 bg-gray-700 rounded text-xs"
              >
                Siguiente →
              </button>
            </div>
          </div>
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">{preview}</pre>
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {templates.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
            No hay plantillas creadas. Crea tu primera plantilla de anuncio.
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    {template.tags?.map((tag) => (
                      <span key={tag} className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2 font-mono">{template.body}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {template.variables.length} variables · {template.variables.reduce((t, v) => t * Math.max(v.values.length, 1), 1)} combinaciones
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handlePreview(template)}
                    className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
                  >
                    Preview
                  </button>
                  <button onClick={() => startEdit(template)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(template.id)} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
