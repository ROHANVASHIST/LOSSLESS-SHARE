import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import { getFileIcon, formatBytes, downloadAsZip } from '../utils/helpers';

const TAG_COLORS = ['#4aa3ff', '#22c997', '#f5c542', '#ff4f6e', '#a855f7', '#f97316', '#ec4899', '#06b8d4'];

export default function ReceivedList({ onComment }) {
  const { state, dispatch, addToast, setConfirm } = useApp();
  const [commentInput, setCommentInput] = useState(null);
  const [showTagPicker, setShowTagPicker] = useState(null);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [renameItem, setRenameItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [editNoteItem, setEditNoteItem] = useState(null);
  const [editNoteValue, setEditNoteValue] = useState('');

  const viewMode = state.viewMode || 'received';
  const searchQuery = state.searchQuery || '';
  const searchType = state.searchType || '';
  const searchTag = state.searchTag || '';
  const sortBy = state.sortBy || 'date-desc';

  const items = useMemo(() => {
    let list = state.received || [];

    if (viewMode === 'received') list = list.filter(i => !i.trashed);
    else if (viewMode === 'favorites') list = list.filter(i => i.favorite && !i.trashed);
    else if (viewMode === 'pinned') {
      const pinnedKeys = state.pinnedItems || [];
      list = list.filter(i => pinnedKeys.includes(`${i.name}|${i.size}`) && !i.trashed);
    }
    else if (viewMode === 'trash') list = list.filter(i => i.trashed);
    else if (viewMode === 'recent') {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      list = list.filter(i => !i.trashed && i.receivedAt > dayAgo);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    if (searchType) {
      list = list.filter(i => (i.mimeType || '').startsWith(searchType));
    }
    if (searchTag) {
      list = list.filter(i => (i.tags || []).includes(searchTag));
    }

    const [field, dir] = sortBy.split('-');
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (field === 'date') cmp = a.receivedAt - b.receivedAt;
      else if (field === 'size') cmp = a.size - b.size;
      else if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'type') cmp = (a.mimeType || '').localeCompare(b.mimeType || '');
      return dir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [state.received, viewMode, searchQuery, searchType, searchTag, sortBy]);

  const handleToggleFavorite = useCallback((item, e) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_FAVORITE', payload: { name: item.name, size: item.size } });
  }, [dispatch]);

  const handleTrash = useCallback((item, e) => {
    e.stopPropagation();
    dispatch({ type: 'TRASH_ITEM', payload: { name: item.name, size: item.size } });
    addToast('Moved to trash', '');
  }, [dispatch, addToast]);

  const handleRestore = useCallback((item, e) => {
    e.stopPropagation();
    dispatch({ type: 'RESTORE_ITEM', payload: { name: item.name, size: item.size } });
    addToast('Restored', 'success');
  }, [dispatch, addToast]);

  const handleDeleteForever = useCallback((item, e) => {
    e.stopPropagation();
    setConfirm('Delete Forever', `${item.name} will be permanently deleted.`, () => {
      dispatch({ type: 'PERMANENT_DELETE', payload: { name: item.name, size: item.size } });
      addToast('Deleted permanently', '');
    });
  }, [dispatch, addToast, setConfirm]);

  const handleEmptyTrash = useCallback(() => {
    setConfirm('Empty Trash', 'All trashed files will be permanently deleted.', () => {
      dispatch({ type: 'EMPTY_TRASH' });
      addToast('Trash emptied', '');
    });
  }, [dispatch, addToast, setConfirm]);

  const handleTagItem = useCallback((item, tagId, e) => {
    e.stopPropagation();
    const current = item.tags || [];
    const next = current.includes(tagId) ? current.filter(t => t !== tagId) : [...current, tagId];
    dispatch({ type: 'SET_TAGS', payload: { name: item.name, size: item.size, tags: next } });
  }, [dispatch]);

  const handleAddTagDef = useCallback(() => {
    if (!newTagName.trim()) return;
    dispatch({ type: 'ADD_TAG_DEF', payload: { name: newTagName.trim(), color: newTagColor } });
    setNewTagName('');
    setShowNewTag(false);
  }, [newTagName, newTagColor, dispatch]);

  const handleRemoveTagDef = useCallback((tagId, e) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_TAG_DEF', payload: tagId });
  }, [dispatch]);

  const handleRenameItem = useCallback((item) => {
    setRenameItem(`${item.name}|${item.size}`);
    setRenameValue(item.name);
  }, []);

  const handleRenameSubmit = useCallback((item) => {
    if (renameValue.trim() && renameValue.trim() !== item.name) {
      dispatch({ type: 'RENAME_RECEIVED', payload: { name: item.name, size: item.size, newName: renameValue.trim() } });
      addToast(`Renamed to ${renameValue.trim()}`, 'success');
    }
    setRenameItem(null);
    setRenameValue('');
  }, [renameValue, dispatch, addToast]);

  const handleEditNote = useCallback((item) => {
    setEditNoteItem(`${item.name}|${item.size}`);
    setEditNoteValue(item.note || '');
  }, []);

  const handleSaveNote = useCallback((item) => {
    dispatch({ type: 'UPDATE_RECEIVED_ITEM', payload: { name: item.name, size: item.size, updates: { note: editNoteValue.trim() } } });
    setEditNoteItem(null);
    addToast('Note updated', 'success');
  }, [editNoteValue, dispatch, addToast]);

  const handleBulkSelect = useCallback((item, e) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_BULK_ITEM', payload: { name: item.name, size: item.size } });
  }, [dispatch]);

  const handleBulkTrash = useCallback(() => {
    if (state.bulkSelected.length === 0) return;
    dispatch({ type: 'BULK_TRASH', payload: state.bulkSelected });
    addToast(`${state.bulkSelected.length} file(s) moved to trash`, '');
  }, [dispatch, state.bulkSelected, addToast]);

  const handleBulkRestore = useCallback(() => {
    if (state.bulkSelected.length === 0) return;
    dispatch({ type: 'BULK_RESTORE', payload: state.bulkSelected });
    addToast(`${state.bulkSelected.length} file(s) restored`, 'success');
  }, [dispatch, state.bulkSelected, addToast]);

  const handleBulkTag = useCallback((tagId) => {
    if (state.bulkSelected.length === 0) return;
    dispatch({ type: 'BULK_TAG', payload: { items: state.bulkSelected, tag: [tagId] } });
    addToast(`Tagged ${state.bulkSelected.length} file(s)`, 'success');
  }, [dispatch, state.bulkSelected, addToast]);

  const handleBulkFavorite = useCallback(() => {
    if (state.bulkSelected.length === 0) return;
    dispatch({ type: 'BULK_FAVORITE', payload: state.bulkSelected });
    addToast(`Starred ${state.bulkSelected.length} file(s)`, 'success');
  }, [dispatch, state.bulkSelected, addToast]);

  const activeBulkCount = state.bulkSelected?.length || 0;

  return (
    <>
      <div className="received-toolbar">
        <div className="received-tabs">
          {['received', 'favorites', 'pinned', 'recent', 'trash'].map(mode => (
            <button
              key={mode}
              className={`tab-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: mode })}
            >
              {mode === 'received' && 'All'}
              {mode === 'favorites' && '\u2605'}
              {mode === 'pinned' && '\u{1F4CC}'}
              {mode === 'recent' && 'Recent'}
              {mode === 'trash' && 'Trash'}
            </button>
          ))}
        </div>
        {viewMode !== 'trash' && items.filter(i => i.url).length > 1 && (
          <button
            className="tab-btn"
            onClick={() => {
              const downloadable = items.filter(i => i.url);
              if (downloadable.length > 0) {
                downloadAsZip(downloadable, `flashshare-${Date.now()}.zip`);
                addToast(`Downloading ${downloadable.length} files as ZIP`, 'success');
              }
            }}
            title="Download all as ZIP"
          >
            {'\u{1F4E6}'} ZIP
          </button>
        )}
        <button
          className={`tab-btn ${state.galleryView ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_GALLERY_VIEW', payload: !state.galleryView })}
          title="Toggle gallery view"
        >
          {state.galleryView ? '\u2630' : '\u25A6'}
        </button>
        <button
          className={`tab-btn bulk-toggle ${state.bulkMode ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_BULK_MODE' })}
        >
          {state.bulkMode ? 'Done' : 'Select'}
        </button>
      </div>

      <div className="received-search">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
          className="search-input"
          autoComplete="off"
        />
        <div className="search-filters">
          <select
            value={searchType}
            onChange={e => dispatch({ type: 'SET_SEARCH_TYPE', payload: e.target.value })}
            className="search-select"
          >
            <option value="">All types</option>
            <option value="image/">Image</option>
            <option value="video/">Video</option>
            <option value="audio/">Audio</option>
            <option value="text/">Text</option>
            <option value="application/pdf">PDF</option>
          </select>
          <select
            value={sortBy}
            onChange={e => dispatch({ type: 'SET_SORT', payload: e.target.value })}
            className="search-select"
          >
            <option value="date-desc">Newest</option>
            <option value="date-asc">Oldest</option>
            <option value="size-desc">Largest</option>
            <option value="size-asc">Smallest</option>
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="type-asc">Type</option>
          </select>
        </div>
        {state.tags && state.tags.length > 0 && (
          <div className="tag-filter-row">
            {state.tags.map(tag => (
              <button
                key={tag.id}
                className={`tag-filter-chip ${searchTag === tag.id ? 'active' : ''}`}
                style={{ '--tag-color': tag.color }}
                onClick={() => dispatch({ type: 'SET_SEARCH_TAG', payload: searchTag === tag.id ? '' : tag.id })}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {state.bulkMode && (
        <div className="bulk-bar-select">
          <button className="btn small" onClick={() => {
            const allKeys = items.map(i => ({ name: i.name, size: i.size }));
            const alreadyAll = allKeys.every(k => state.bulkSelected.some(s => s.name === k.name && s.size === k.size));
            if (alreadyAll) {
              dispatch({ type: 'CLEAR_BULK' });
            } else {
              allKeys.forEach(k => dispatch({ type: 'TOGGLE_BULK_ITEM', payload: k }));
            }
          }}>
            {items.every(i => state.bulkSelected.some(s => s.name === i.name && s.size === i.size)) ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}
      {state.bulkMode && activeBulkCount > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{activeBulkCount} selected</span>
          {viewMode === 'trash' ? (
            <button onClick={handleBulkRestore} className="btn small">Restore All</button>
          ) : (
            <>
              <button onClick={handleBulkFavorite} className="btn small">{'\u2605'} Star</button>
              <div className="bulk-tags">
                {(state.tags || []).map(tag => (
                  <button
                    key={tag.id}
                    className="btn small"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: tag.color, color: tag.color }}
                    onClick={() => handleBulkTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              <button onClick={handleBulkTrash} className="btn small danger">Trash</button>
            </>
          )}
        </div>
      )}

      <div className={`received-list${state.galleryView ? ' gallery-view' : ''}`}>
        {items.length === 0 ? (
          <div className="peer-placeholder">
            {viewMode === 'trash' ? 'Trash is empty' : viewMode === 'favorites' ? 'No starred files yet.\nStar files to find them quickly!' : viewMode === 'pinned' ? 'No pinned files.\nPin files to keep them accessible!' : viewMode === 'recent' ? 'Nothing shared today' : searchQuery ? 'No matching files' : 'No files received yet.\nShare files to get started!'}
          </div>
        ) : (
          items.map((item, i) => {
            const ext = item.name.split('.').pop()?.toUpperCase() || 'FILE';
            const isSelected = state.bulkSelected?.some(p => p.name === item.name && p.size === item.size);
            return (
              <div
                key={`${item.name}-${item.size}-${i}`}
                className={`received-item${item.favorite ? ' starred' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => {
                  if (state.bulkMode) return;
                  if (item.url && item.mimeType?.startsWith('image/')) {
                    const images = state.received.filter(r => !r.trashed && r.url && r.mimeType?.startsWith('image/'));
                    const idx = images.findIndex(r => r.name === item.name && r.size === item.size);
                    dispatch({ type: 'SET_LIGHTBOX', payload: { images: images.map(r => ({ url: r.url, name: r.name })), startIndex: Math.max(0, idx) } });
                  } else if (item.url) {
                    window.open(item.url, '_blank');
                  }
                }}
              >
                <div className="received-item-top">
                  {state.bulkMode && (
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={!!isSelected}
                      onChange={e => handleBulkSelect(item, e)}
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                  <span className="received-item-icon">{getFileIcon(item.mimeType, item.name)}</span>
                  {renameItem === `${item.name}|${item.size}` ? (
                    <input
                      type="text"
                      className="rename-inline-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit(item);
                        if (e.key === 'Escape') { setRenameItem(null); setRenameValue(''); }
                      }}
                      onBlur={() => handleRenameSubmit(item)}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="received-item-name" title={item.name}>{item.name}</span>
                  )}
                  <span className="received-item-size">{formatBytes(item.size)}</span>
                  <button
                    className={`star-btn ${item.favorite ? 'active' : ''}`}
                    onClick={e => handleToggleFavorite(item, e)}
                    title={item.favorite ? 'Unstar' : 'Star'}
                  >
                    {item.favorite ? '\u2605' : '\u2606'}
                  </button>
                </div>
                <div className="received-item-meta">
                  <span className="tag">{ext}</span>
                  {item.relativePath && (
                    <span className="folder-badge" title={item.relativePath}>
                      {'\u{1F4C1}'}{item.relativePath.split('/').slice(0, -1).join('/') || '/'}
                    </span>
                  )}
                  {(item.versions || []).length > 0 && (
                    <span className="version-badge" title={`${(item.versions || []).length + 1} versions`}>
                      v{(item.versions || []).length + 1}
                    </span>
                  )}
                  {(item.tags || []).length > 0 && (
                    <div className="item-tags">
                      {(item.tags || []).map(tagId => {
                        const def = state.tags?.find(t => t.id === tagId);
                        return def ? (
                          <span key={tagId} className="item-tag" style={{ backgroundColor: def.color + '33', color: def.color, borderColor: def.color }}>
                            {def.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <div className="received-item-actions">
                    {!state.bulkMode && (
                      <>
                        {viewMode === 'trash' ? (
                          <>
                            <button className="action-btn" onClick={e => handleRestore(item, e)} title="Restore">{'\u21A9'}</button>
                            <button className="action-btn danger" onClick={e => handleDeleteForever(item, e)} title="Delete forever">{'\u2716'}</button>
                          </>
                        ) : (
                          <>
                            <div className="tag-picker-wrapper">
                              <button className="action-btn" onClick={e => { e.stopPropagation(); setShowTagPicker(showTagPicker === `${item.name}|${item.size}` ? null : `${item.name}|${item.size}`); }} title="Tag">{'\uD83C\uDFF7'}</button>
                              {showTagPicker === `${item.name}|${item.size}` && (
                                <div className="tag-picker-dropdown" onClick={e => e.stopPropagation()}>
                                  {(state.tags || []).map(tag => (
                                    <label key={tag.id} className="tag-picker-item" style={{ '--tag-color': tag.color }}>
                                      <input
                                        type="checkbox"
                                        checked={(item.tags || []).includes(tag.id)}
                                        onChange={e => handleTagItem(item, tag.id, e)}
                                      />
                                      <span style={{ color: tag.color }}>{tag.name}</span>
                                    </label>
                                  ))}
                                  <button className="btn small" style={{ width: '100%', marginTop: 4 }} onClick={e => { e.stopPropagation(); setShowNewTag(true); }}>
                                    + New Tag
                                  </button>
                                </div>
                              )}
                            </div>
                            <button className="action-btn" onClick={e => { e.stopPropagation(); setCommentInput(commentInput === `${item.name}|${item.size}` ? null : `${item.name}|${item.size}`); }} title="Comment">{'\uD83D\uDCAC'}</button>
                            <button className="action-btn" onClick={e => { e.stopPropagation(); handleRenameItem(item); }} title="Rename">{'\u270F\uFE0F'}</button>
                            <button className="action-btn danger" onClick={e => handleTrash(item, e)} title="Trash">{'\uD83D\uDDD1'}</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {editNoteItem === `${item.name}|${item.size}` ? (
                  <div className="item-note-edit" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editNoteValue}
                      onChange={e => setEditNoteValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveNote(item);
                        if (e.key === 'Escape') setEditNoteItem(null);
                      }}
                      onBlur={() => handleSaveNote(item)}
                      autoFocus
                      placeholder="Add a note..."
                      className="note-edit-input"
                    />
                  </div>
                ) : item.note ? (
                  <div className="item-note" onClick={e => e.stopPropagation()}>
                    {'\uD83D\uDCCB'} {item.note}
                    <button className="note-edit-btn" onClick={e => { e.stopPropagation(); handleEditNote(item); }} title="Edit note">{'\u270F\uFE0F'}</button>
                  </div>
                ) : !state.bulkMode && viewMode !== 'trash' && (
                  <div className="item-note-add" onClick={e => { e.stopPropagation(); handleEditNote(item); }}>
                    + Add note
                  </div>
                )}
                {(item.comments || []).length > 0 && (
                  <div className="comment-list" onClick={e => e.stopPropagation()}>
                    {item.comments.map((c, ci) => (
                      <div key={ci} className="comment-item">
                        <span className="comment-from">{c.from ? `@${c.from.slice(0, 6)}` : ''}</span>
                        <span className="comment-text">{highlightMentions(c.text)}</span>
                        <span className="comment-time">{formatCommentTime(c.ts)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {commentInput === `${item.name}|${item.size}` && (
                  <div className="comment-input-row" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Write a comment... @mention"
                      className="comment-input"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const peerIds = Object.values(state.peers).filter(p => p.connected).map(p => p.id);
                          peerIds.forEach(pid => onComment?.(pid, item.name, item.size, e.target.value.trim()));
                          e.target.value = '';
                          setCommentInput(null);
                        }
                        if (e.key === 'Escape') setCommentInput(null);
                      }}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {viewMode === 'trash' && items.length > 0 && (
        <button onClick={handleEmptyTrash} className="btn small danger" style={{ width: '100%', marginTop: 8 }}>
          Empty Trash
        </button>
      )}

      {showNewTag && (
        <div className="modal-overlay" onClick={() => setShowNewTag(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Tag</h3>
            <input
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddTagDef()}
            />
            <div className="tag-color-picker">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`color-dot ${newTagColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowNewTag(false)} className="btn small">Cancel</button>
              <button onClick={handleAddTagDef} className="btn small primary">Add Tag</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function highlightMentions(text) {
  if (!text) return text;
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@') ? <span key={i} className="mention">{part}</span> : part
  );
}

function formatCommentTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
