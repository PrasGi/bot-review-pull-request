/* @ds-bundle: {"format":4,"namespace":"PRR","components":[{"name":"Button"},{"name":"Badge"},{"name":"Card"},{"name":"Input"},{"name":"PasswordInput"},{"name":"Textarea"},{"name":"Select"},{"name":"Checkbox"},{"name":"RadioGroup"},{"name":"Switch"},{"name":"Slider"},{"name":"Dialog"},{"name":"ConfirmDialog"},{"name":"DropdownMenu"},{"name":"Tooltip"},{"name":"Skeleton"},{"name":"Toaster"},{"name":"AppShell"},{"name":"Sidebar"},{"name":"Header"},{"name":"PageHeader"},{"name":"SectionHeading"},{"name":"ThemeToggle"},{"name":"WhatsNew"},{"name":"StatusDot"},{"name":"LiveIndicator"},{"name":"StatCard"},{"name":"SummaryCard"},{"name":"BudgetMeter"},{"name":"AttentionList"},{"name":"DataTable"},{"name":"Pagination"},{"name":"BarChart"},{"name":"LineChart"},{"name":"DonutChart"},{"name":"ChartCard"},{"name":"DescriptionList"},{"name":"FindingCard"},{"name":"CodeBlock"},{"name":"Disclosure"},{"name":"EmptyState"},{"name":"ErrorState"},{"name":"AccountCard"},{"name":"Avatar"},{"name":"RepoGroup"},{"name":"ProviderKeyRow"},{"name":"LoginCard"},{"name":"Icon"}]} */
/* PR Reviewer brutalist kit. Hand-written, dependency-free (React 18+ only), ~ one small file. */
(function () {
  var React = window.React, ReactDOM = window.ReactDOM, h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useId = React.useId;

  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k]; return o; }
  function slug(s) { return s ? String(s).toLowerCase().replace(/\s+/g, '-') : undefined; }
  function useFieldId(id, label) { var auto = useId ? useId() : 'f' + Math.random().toString(36).slice(2); return id || slug(label) || auto; }

  /* Button */
  var Button = React.forwardRef(function (p, ref) {
    var variant = p.variant || 'primary', size = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'loading', 'className', 'children', 'disabled', 'type']);
    return h('button', Object.assign({ ref: ref, type: p.type || 'button',
      className: cx('prr-btn', 'prr-btn--' + variant, 'prr-btn--' + size, p.className),
      disabled: p.disabled != null ? p.disabled : !!p.loading, 'aria-busy': p.loading ? true : undefined }, rest),
      p.loading ? h('span', { className: 'prr-spin', 'aria-hidden': true }) : null, p.children);
  });

  /* Badge */
  function Badge(p) {
    return h('span', Object.assign({ className: cx('prr-badge', 'prr-badge--' + (p.variant || 'neutral'), p.className) },
      omit(p, ['variant', 'className', 'children'])), p.children);
  }

  /* Card (repo GlassCard) */
  function Card(p) {
    return h('div', Object.assign({ className: cx('prr-card', p.hoverLift && 'prr-card--lift', p.className) },
      omit(p, ['hoverLift', 'className', 'children', 'kicker', 'title'])),
      p.kicker ? h('p', { className: 'prr-card-kicker' }, p.kicker) : null,
      p.title ? h('h3', { className: 'prr-card-title' }, p.title) : null, p.children);
  }

  /* Field shell shared by Input / Textarea / Select / Slider */
  function Field(props, fid, control) {
    var errId = fid + '-error', hintId = fid + '-hint';
    return h('div', { className: cx('prr-fieldset', props.containerClassName) },
      props.label ? h('label', { htmlFor: fid, className: 'prr-label' }, props.label) : null,
      control(props.error ? errId : props.hint ? hintId : undefined),
      props.error ? h('p', { id: errId, className: 'prr-error', role: 'alert', key: props.error }, props.error)
        : props.hint ? h('p', { id: hintId, className: 'prr-hint' }, props.hint) : null);
  }
  var FIELD_KEYS = ['label', 'error', 'hint', 'containerClassName', 'className', 'id'];

  var Input = React.forwardRef(function (p, ref) {
    var fid = useFieldId(p.id, p.label);
    return Field(p, fid, function (desc) {
      return h('input', Object.assign({ ref: ref, id: fid, className: cx('prr-field', p.className),
        'aria-invalid': !!p.error, 'aria-describedby': desc }, omit(p, FIELD_KEYS)));
    });
  });

  var PasswordInput = React.forwardRef(function (p, ref) {
    var fid = useFieldId(p.id, p.label), s = useState(false), vis = s[0], setVis = s[1];
    return Field(p, fid, function (desc) {
      return h('div', { className: 'prr-pw' },
        h('input', Object.assign({ ref: ref, id: fid, type: vis ? 'text' : 'password', className: cx('prr-field', p.className),
          'aria-invalid': !!p.error, 'aria-describedby': desc }, omit(p, FIELD_KEYS.concat(['type'])))),
        h('button', { type: 'button', className: 'prr-pw-toggle', onClick: function () { setVis(!vis); },
          'aria-label': vis ? 'Hide password' : 'Show password' }, vis ? 'Hide' : 'Show'));
    });
  });

  var Textarea = React.forwardRef(function (p, ref) {
    var fid = useFieldId(p.id, p.label), inner = useRef(null);
    function fit() { var el = inner.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(p.minHeight || 96, el.scrollHeight + 4) + 'px'; }
    useEffect(fit, [p.value]);
    return Field(p, fid, function (desc) {
      return h('textarea', Object.assign({ id: fid, rows: 3, className: cx('prr-field prr-textarea', p.className),
        'aria-invalid': !!p.error, 'aria-describedby': desc }, omit(p, FIELD_KEYS.concat(['minHeight', 'onInput'])), {
          ref: function (el) { inner.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; },
          onInput: function (e) { fit(); p.onInput && p.onInput(e); } }));
    });
  });
  /* Select: fully custom listbox (no native <select>) */
  var Select = React.forwardRef(function (p, ref) {
    var fid = useFieldId(p.id, p.label), opts = p.options || [], ctl = p.value !== undefined;
    var s = useState(p.defaultValue !== undefined ? p.defaultValue : (p.placeholder ? '' : (opts[0] && opts[0].value))), val = ctl ? p.value : s[0];
    var o = useState(!!p.defaultOpen), open = o[0], setOpen = o[1];
    var a = useState(-1), act = a[0], setAct = a[1];
    var wrap = useRef(null), btn = useRef(null), list = useRef(null), typed = useRef({ q: '', t: 0 });
    var cur = null; for (var i = 0; i < opts.length; i++) if (opts[i].value === val) cur = opts[i];
    var listId = fid + '-list';
    function openList() { if (p.disabled) return; var idx = opts.indexOf(cur); setAct(idx < 0 ? 0 : idx); setOpen(true); }
    function pick(opt) {
      if (!opt || opt.disabled) return;
      if (!ctl) s[1](opt.value);
      var ev = { target: { value: opt.value, name: p.name }, currentTarget: { value: opt.value, name: p.name } };
      p.onChange && p.onChange(ev); p.onValueChange && p.onValueChange(opt.value);
      setOpen(false); btn.current && btn.current.focus();
    }
    function move(d) { var n = opts.length, i = act; for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (!opts[i].disabled) break; } setAct(i); }
    useEffect(function () {
      if (!open) return;
      function out(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
      document.addEventListener('mousedown', out); return function () { document.removeEventListener('mousedown', out); };
    }, [open]);
    useEffect(function () { if (open && list.current) { var el = list.current.children[act]; el && el.scrollIntoView && el.scrollIntoView({ block: 'nearest' }); } }, [act, open]);
    function onKey(e) {
      var k = e.key;
      if (!open) { if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); openList(); } return; }
      if (k === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (k === 'Home') { e.preventDefault(); setAct(0); }
      else if (k === 'End') { e.preventDefault(); setAct(opts.length - 1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(opts[act]); }
      else if (k === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (k === 'Tab') setOpen(false);
      else if (k.length === 1) {
        var t = typed.current, now = Date.now(); t.q = (now - t.t > 600 ? '' : t.q) + k.toLowerCase(); t.t = now;
        for (var j = 0; j < opts.length; j++) if (String(opts[j].label).toLowerCase().indexOf(t.q) === 0) { setAct(j); break; }
      }
    }
    return Field(p, fid, function (desc) {
      return h('div', { ref: wrap, className: cx('prr-select', open && 'is-open') },
        h('button', { ref: function (el) { btn.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; },
          id: fid, type: 'button', role: 'combobox', 'aria-haspopup': 'listbox', 'aria-expanded': open, 'aria-controls': listId,
          'aria-activedescendant': open && act >= 0 ? listId + '-' + act : undefined, 'aria-invalid': !!p.error, 'aria-describedby': desc,
          'aria-label': p['aria-label'], disabled: p.disabled, className: cx('prr-field prr-select-btn', !cur && 'is-placeholder', p.className),
          onClick: function () { open ? setOpen(false) : openList(); }, onKeyDown: onKey },
          h('span', { className: 'prr-select-value' }, cur ? cur.label : (p.placeholder || 'Select…')),
          h('span', { className: 'prr-select-caret', 'aria-hidden': true })),
        p.name ? h('input', { type: 'hidden', name: p.name, value: val == null ? '' : val }) : null,
        open ? h('ul', { ref: list, id: listId, role: 'listbox', className: 'prr-listbox', 'aria-labelledby': fid },
          opts.map(function (opt, i) {
            var sel = opt.value === val;
            return h('li', { key: opt.value, id: listId + '-' + i, role: 'option', 'aria-selected': sel, 'aria-disabled': opt.disabled || undefined,
              className: cx('prr-option', i === act && 'is-active', sel && 'is-selected', opt.disabled && 'is-disabled'),
              onMouseEnter: function () { setAct(i); }, onMouseDown: function (e) { e.preventDefault(); }, onClick: function () { pick(opt); } },
              h('span', { className: 'prr-option-check', 'aria-hidden': true }, sel ? '■' : ''), h('span', null, opt.label));
          })) : null);
    });
  });
  /* Checkbox */
  var Checkbox = React.forwardRef(function (p, ref) {
    return h('label', { className: cx('prr-check', p.className) },
      h('input', Object.assign({ ref: ref, type: 'checkbox' }, omit(p, ['label', 'className', 'children']))),
      h('span', { className: 'prr-box', 'aria-hidden': true },
        h('svg', { viewBox: '0 0 16 16' }, h('path', { d: 'M2.5 8.5l3.5 3.5 7.5-8', strokeLinecap: 'square' }))),
      p.label || p.children ? h('span', null, p.label || p.children) : null);
  });

  /* RadioGroup */
  function RadioGroup(p) {
    var auto = useId ? useId() : 'r';
    var name = p.name || auto, ctl = p.value !== undefined;
    var s = useState(p.defaultValue), inner = s[0], setInner = s[1], cur = ctl ? p.value : inner;
    return h('fieldset', { className: cx('prr-fieldset', p.className) },
      p.label ? h('legend', { className: 'prr-label', style: { marginBottom: 6, padding: 0 } }, p.label) : null,
      h('div', { className: cx('prr-radio-group', p.orientation === 'horizontal' && 'prr-radio-group--row'), role: 'radiogroup' },
        (p.options || []).map(function (o) {
          return h('label', { key: o.value, className: 'prr-radio' },
            h('input', { type: 'radio', name: name, value: o.value, checked: cur === o.value, disabled: p.disabled || o.disabled,
              onChange: function () { if (!ctl) setInner(o.value); p.onValueChange && p.onValueChange(o.value); } }),
            h('span', { className: 'prr-dot', 'aria-hidden': true }), h('span', null, o.label));
        })));
  }

  /* Switch */
  var Switch = React.forwardRef(function (p, ref) {
    var sid = useFieldId(p.id, p.label), ctl = p.checked !== undefined;
    var s = useState(!!p.defaultChecked), inner = s[0], setInner = s[1], on = ctl ? p.checked : inner;
    return h('div', { className: 'prr-switch-row' },
      h('button', Object.assign({ ref: ref, id: sid, type: 'button', role: 'switch', 'aria-checked': on, className: cx('prr-switch', p.className),
        onClick: function () { if (!ctl) setInner(!on); p.onCheckedChange && p.onCheckedChange(!on); } },
        omit(p, ['label', 'checked', 'defaultChecked', 'onCheckedChange', 'className', 'id']))),
      p.label ? h('label', { htmlFor: sid, className: 'prr-switch-label' }, p.label) : null);
  });

  /* Slider: fully custom (no native range). Value may be a number or a one-item array, like the repo's Radix slider. */
  function Slider(p) {
    var fid = useFieldId(p.id, p.label), min = p.min != null ? p.min : 0, max = p.max != null ? p.max : 100, step = p.step || 1;
    var first = function (v) { return Array.isArray(v) ? v[0] : v; };
    var ctl = p.value !== undefined, s = useState(first(p.defaultValue) != null ? first(p.defaultValue) : min);
    var val = ctl ? first(p.value) : s[0], track = useRef(null), dr = useState(false), drag = dr[0];
    var pct = ((val - min) / (max - min || 1)) * 100;
    function set(n) {
      n = Math.min(max, Math.max(min, Math.round((n - min) / step) * step + min)); n = Number(n.toFixed(6));
      if (n === val) return; if (!ctl) s[1](n);
      p.onValueChange && p.onValueChange(Array.isArray(p.value || p.defaultValue) ? [n] : n);
    }
    function fromX(x) { var r = track.current.getBoundingClientRect(); set(min + (Math.min(Math.max(0, x - r.left), r.width) / (r.width || 1)) * (max - min)); }
    function down(e) {
      if (p.disabled) return; e.preventDefault(); fromX(e.clientX); dr[1](true);
      var th = track.current.querySelector('.prr-slider-thumb'); th && th.focus();
      function mv(ev) { fromX(ev.clientX); }
      function up() { dr[1](false); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    function key(e) {
      var big = Math.max(step, (max - min) / 10), m = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big };
      if (m[e.key] != null) { e.preventDefault(); set(val + m[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); set(min); } else if (e.key === 'End') { e.preventDefault(); set(max); }
    }
    var shown = p.format ? p.format(val) : val;
    return h('div', { className: cx('prr-fieldset', p.className) },
      p.label ? h('div', { className: 'prr-slider-head' }, h('span', { id: fid + '-label', className: 'prr-label' }, p.label),
        h('span', { className: 'prr-slider-value' }, shown)) : null,
      h('div', { ref: track, className: cx('prr-slider', drag && 'is-dragging', p.disabled && 'is-disabled'), onPointerDown: down },
        h('span', { className: 'prr-slider-track' }, h('span', { className: 'prr-slider-range', style: { width: pct + '%' } })),
        h('span', { id: fid, role: 'slider', tabIndex: p.disabled ? -1 : 0, className: 'prr-slider-thumb', style: { left: pct + '%' },
          'aria-valuemin': min, 'aria-valuemax': max, 'aria-valuenow': val, 'aria-valuetext': String(shown), 'aria-disabled': p.disabled || undefined,
          'aria-labelledby': p.label ? fid + '-label' : undefined, 'aria-label': p.label ? undefined : p['aria-label'], onKeyDown: key })));
  }
  /* Dialog */
  var FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function Dialog(p) {
    var box = useRef(null), prev = useRef(null);
    useEffect(function () {
      if (!p.open) return;
      prev.current = document.activeElement;
      var el = box.current, f = el && el.querySelectorAll(FOCUSABLE);
      (f && f.length ? f[0] : el) && (f && f.length ? f[0] : el).focus();
      function key(e) {
        if (e.key === 'Escape') { e.stopPropagation(); p.onOpenChange && p.onOpenChange(false); }
        if (e.key === 'Tab' && el) {
          var list = el.querySelectorAll(FOCUSABLE); if (!list.length) return;
          var a = list[0], z = list[list.length - 1];
          if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
          else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        }
      }
      document.addEventListener('keydown', key);
      return function () { document.removeEventListener('keydown', key); prev.current && prev.current.focus && prev.current.focus(); };
    }, [p.open]);
    if (!p.open) return null;
    var tid = 'dlg-title', did = 'dlg-desc';
    var node = h('div', { className: 'prr-overlay', onMouseDown: function (e) { if (e.target === e.currentTarget && p.onOpenChange) p.onOpenChange(false); } },
      h('div', { ref: box, role: p.role || 'dialog', 'aria-modal': true, 'aria-labelledby': p.title ? tid : undefined,
        'aria-describedby': p.description ? did : undefined, tabIndex: -1, className: cx('prr-dialog', p.className) },
        p.title ? h('h2', { id: tid, className: 'prr-dialog-title' }, p.title) : null,
        p.description ? h('p', { id: did, className: 'prr-dialog-desc' }, p.description) : null,
        p.children,
        p.showClose !== false ? h('button', { type: 'button', className: 'prr-icon-btn', 'aria-label': 'Close',
          onClick: function () { p.onOpenChange && p.onOpenChange(false); } }, '✕') : null));
    return p.inline ? node : ReactDOM.createPortal(node, document.body);
  }

  function ConfirmDialog(p) {
    return h(Dialog, { open: p.open, onOpenChange: p.onOpenChange, title: p.title, description: p.description, showClose: false, role: 'alertdialog', inline: p.inline },
      h('div', { className: 'prr-dialog-actions' },
        h(Button, { variant: 'secondary', onClick: function () { p.onOpenChange(false); }, disabled: p.loading }, p.cancelLabel || 'Cancel'),
        h(Button, { variant: p.destructive ? 'destructive' : 'primary', onClick: p.onConfirm, loading: p.loading }, p.confirmLabel || 'Confirm')));
  }

  /* DropdownMenu: trigger element + items as children */
  var MenuCtx = React.createContext(function () {});
  function DropdownMenu(p) {
    var s = useState(!!p.defaultOpen), open = s[0], setOpen = s[1], wrap = useRef(null), list = useRef(null);
    useEffect(function () {
      if (!open) return;
      var items = list.current ? list.current.querySelectorAll('.prr-menu-item:not([disabled])') : [];
      items.length && items[0].focus();
      function out(e) { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); }
      document.addEventListener('mousedown', out);
      return function () { document.removeEventListener('mousedown', out); };
    }, [open]);
    function onKey(e) {
      if (e.key === 'Escape') { setOpen(false); var t = wrap.current && wrap.current.querySelector('[aria-haspopup]'); t && t.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var items = Array.prototype.slice.call(list.current.querySelectorAll('.prr-menu-item:not([disabled])'));
      var i = items.indexOf(document.activeElement), n = items.length;
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
    }
    var trig = React.cloneElement(p.trigger, { 'aria-haspopup': 'menu', 'aria-expanded': open,
      onClick: function (e) { p.trigger.props.onClick && p.trigger.props.onClick(e); setOpen(!open); } });
    return h(MenuCtx.Provider, { value: function () { setOpen(false); } },
      h('div', { ref: wrap, className: 'prr-menu-wrap', onKeyDown: onKey }, trig,
        open ? h('div', { ref: list, role: 'menu', className: cx('prr-menu', p.align === 'end' && 'prr-menu--end', p.className) }, p.children) : null));
  }
  function DropdownMenuItem(p) {
    var close = React.useContext(MenuCtx);
    return h('button', Object.assign({ type: 'button', role: 'menuitem', className: cx('prr-menu-item', p.destructive && 'prr-menu-item--destructive', p.className),
      onClick: function (e) { p.onSelect && p.onSelect(e); p.onClick && p.onClick(e); close(); } },
      omit(p, ['destructive', 'className', 'onSelect', 'onClick', 'children'])), p.children);
  }
  function DropdownMenuLabel(p) { return h('div', { className: 'prr-menu-label' }, p.children); }
  function DropdownMenuSeparator() { return h('div', { className: 'prr-menu-sep', role: 'separator' }); }

  /* Tooltip */
  function Tooltip(p) {
    var s = useState(false), show = s[0], set = s[1], t = useRef(0), tid = useFieldId(null, null);
    function on() { clearTimeout(t.current); t.current = setTimeout(function () { set(true); }, p.delayDuration != null ? p.delayDuration : 150); }
    function off() { clearTimeout(t.current); set(false); }
    return h('span', { className: 'prr-tip-wrap', onMouseEnter: on, onMouseLeave: off, onFocus: on, onBlur: off,
      onKeyDown: function (e) { if (e.key === 'Escape') off(); } },
      React.cloneElement(p.children, { 'aria-describedby': show ? tid : undefined }),
      show || p.open ? h('span', { id: tid, role: 'tooltip', className: cx('prr-tip', p.side && p.side !== 'top' && 'prr-tip--' + p.side, p.className) }, p.content) : null);
  }

  /* Skeleton */
  function Skeleton(p) {
    return h('span', Object.assign({ className: cx('prr-skel', p.className), 'aria-hidden': true }, omit(p, ['className'])));
  }

  /* Toast: a tiny store + <Toaster/> */
  var toasts = [], subs = [], seq = 0;
  function emit() { subs.forEach(function (f) { f(toasts.slice()); }); }
  function push(kind, message, description, opts) {
    var id = ++seq, dur = opts && opts.duration != null ? opts.duration : 4000;
    toasts = toasts.concat([{ id: id, kind: kind, message: message, description: description }]); emit();
    if (kind !== 'loading' && isFinite(dur)) setTimeout(function () { dismiss(id); }, dur);
    return id;
  }
  function dismiss(id) { toasts = id == null ? [] : toasts.filter(function (t) { return t.id !== id; }); emit(); }
  var MARK = { success: '✓', error: '✕', warning: '!', info: 'i', loading: '◼' };
  var toast = {
    success: function (m, d, o) { return push('success', m, d, o); }, error: function (m, d, o) { return push('error', m, d, o); },
    warning: function (m, d, o) { return push('warning', m, d, o); }, info: function (m, d, o) { return push('info', m, d, o); },
    loading: function (m) { return push('loading', m); }, dismiss: dismiss
  };
  function Toaster(p) {
    var s = useState(toasts), list = s[0], set = s[1];
    useEffect(function () { subs.push(set); return function () { subs = subs.filter(function (f) { return f !== set; }); }; }, []);
    var node = h('div', { className: cx('prr-toaster', p.inline && 'prr-toaster--inline'), role: 'region', 'aria-label': 'Notifications', 'aria-live': 'polite' },
      list.map(function (t) {
        return h('div', { key: t.id, className: 'prr-toast prr-toast--' + t.kind, role: t.kind === 'error' ? 'alert' : 'status' },
          h('span', { className: 'prr-toast-mark', 'aria-hidden': true }, MARK[t.kind]),
          h('div', null, h('p', { className: 'prr-toast-title' }, t.message), t.description ? h('p', { className: 'prr-toast-desc' }, t.description) : null),
          h('button', { type: 'button', className: 'prr-toast-x', 'aria-label': 'Dismiss', onClick: function () { dismiss(t.id); } }, '✕'));
      }));
    return p.inline ? node : ReactDOM.createPortal(node, document.body);
  }

  window.PRR = {
    Button: Button, Badge: Badge, Card: Card, GlassCard: Card,
    Input: Input, PasswordInput: PasswordInput, Textarea: Textarea, Select: Select,
    Checkbox: Checkbox, RadioGroup: RadioGroup, Switch: Switch, Slider: Slider,
    Dialog: Dialog, ConfirmDialog: ConfirmDialog,
    DropdownMenu: DropdownMenu, DropdownMenuItem: DropdownMenuItem, DropdownMenuLabel: DropdownMenuLabel, DropdownMenuSeparator: DropdownMenuSeparator,
    Tooltip: Tooltip, Skeleton: Skeleton, Toaster: Toaster, AppToaster: Toaster, toast: toast
  };
})();

/* PR Reviewer — dashboard layer (layout, data display, charts). Extends window.PRR. */
(function () {
  var React = window.React, ReactDOM = window.ReactDOM, h = React.createElement, P = window.PRR;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useLayoutEffect = React.useLayoutEffect || React.useEffect;
  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k]; return o; }

  /* ---------- Icon: small square-capped glyphs on a 24 grid (not lucide) ---------- */
  var ICONS = {
    dashboard: 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z',
    pr: 'M6 3v12M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6M18 21V9a3 3 0 0 0-3-3h-4M13 3l-3 3l3 3M18 15a3 3 0 1 0 0 6',
    chart: 'M3 3v18h18M7 17v-5M12 17V7M17 17v-8',
    folder: 'M3 5h7l2 3h9v11H3zM12 11v5M12 11a2 2 0 1 0 0-.1',
    settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    chevronLeft: 'M15 5l-7 7l7 7', chevronRight: 'M9 5l7 7l-7 7', chevronDown: 'M5 9l7 7l7-7',
    arrowLeft: 'M20 12H4M10 6l-6 6l6 6',
    bell: 'M6 16V10a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
    sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
    moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    more: 'M12 5v.01M12 12v.01M12 19v.01',
    logout: 'M9 3H4v18h5M16 17l5-5l-5-5M21 12H9',
    refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
    alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 3',
    wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M12 20v.01M19 13a10 10 0 0 0-2-1.6',
    check: 'M4 12l5 5L20 6', checkCheck: 'M2 12l5 5L18 6M12 17l1 1l9-11',
    external: 'M14 3h7v7M21 3l-9 9M18 14v7H3V6h7',
    download: 'M12 3v12M6 10l6 6l6-6M4 21h16',
    fork: 'M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3M12 12v6M12 18a2 2 0 1 0 0 4',
    building: 'M4 21V3h11v18M15 9h5v12M8 7h3M8 11h3M8 15h3M2 21h20',
    user: 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21a8 8 0 0 1 16 0',
    plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
    search: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14M21 21l-6-6',
    x: 'M5 5l14 14M19 5L5 19', plus: 'M12 4v16M4 12h16'
  };
  function Icon(p) {
    var d = ICONS[p.name] || ICONS.x, s = p.size || 16;
    return h('svg', { className: cx('prr-icon', p.className), width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: p.strokeWidth || 2.5, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': p.label ? undefined : true,
      role: p.label ? 'img' : undefined, 'aria-label': p.label }, h('path', { d: d }));
  }
  function ic(x, s) { return typeof x === 'string' ? h(Icon, { name: x, size: s }) : x; }

  /* ---------- Popover (generic; WhatsNew & AdminMenu use it) ---------- */
  function Popover(p) {
    var s = useState(!!p.defaultOpen), open = p.open !== undefined ? p.open : s[0];
    var wrap = useRef(null);
    function set(v) { if (p.open === undefined) s[1](v); p.onOpenChange && p.onOpenChange(v); }
    useEffect(function () {
      if (!open) return;
      function out(e) { if (wrap.current && !wrap.current.contains(e.target)) set(false); }
      function key(e) { if (e.key === 'Escape') set(false); }
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key);
      return function () { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
    }, [open]);
    var trig = React.cloneElement(p.trigger, { 'aria-expanded': open, 'aria-haspopup': 'dialog',
      onClick: function (e) { p.trigger.props.onClick && p.trigger.props.onClick(e); set(!open); } });
    return h('div', { ref: wrap, className: cx('prr-menu-wrap', p.wrapClassName) }, trig,
      open ? h('div', { role: 'dialog', 'aria-label': p.label, className: cx('prr-menu prr-pop', p.align === 'end' && 'prr-menu--end', p.side === 'top' && 'prr-menu--top', p.className), style: p.style },
        typeof p.children === 'function' ? p.children(function () { set(false); }) : p.children) : null);
  }

  /* ---------- Brand ---------- */
  function BrandMark(p) {
    return h('div', { className: cx('prr-brand', p.className) },
      h('span', { className: 'prr-brand-mark', 'aria-hidden': true }, h(Icon, { name: 'pr', size: p.compact ? 18 : 16 })),
      p.compact ? null : h('span', { className: 'prr-brand-name' }, p.name || 'PR Reviewer'));
  }

  /* ---------- ThemeToggle ---------- */
  function ThemeToggle(p) {
    var root = document.documentElement;
    var s = useState(function () { return root.getAttribute('data-theme') || 'light'; });
    var theme = p.theme || s[0], dark = theme === 'dark';
    function flip() {
      var next = dark ? 'light' : 'dark';
      if (!p.theme) { root.setAttribute('data-theme', next); s[1](next); }
      p.onThemeChange && p.onThemeChange(next);
    }
    return h(P.Tooltip, { content: 'Toggle theme', side: p.tooltipSide },
      h(P.Button, { variant: 'ghost', size: 'icon', onClick: flip, className: 'prr-theme-btn', 'aria-label': dark ? 'Switch to light theme' : 'Switch to dark theme' },
        h('span', { className: 'prr-theme-glyph', key: theme }, h(Icon, { name: dark ? 'sun' : 'moon' }))));
  }

  /* ---------- StatusDot & LiveIndicator ---------- */
  var STATUS_TXT = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' };
  function StatusDot(p) {
    var st = p.status || 'healthy', label = p.label || STATUS_TXT[st];
    return h(P.Tooltip, { content: p.tooltip || 'System ' + label.toLowerCase() },
      h('span', { className: cx('prr-status', 'prr-status--' + st), role: 'status', tabIndex: 0, 'aria-label': 'System status: ' + label.toLowerCase() },
        h('span', { className: 'prr-status-dot', 'aria-hidden': true }), p.hideLabel ? null : h('span', null, label)));
  }
  function LiveIndicator(p) {
    return h('span', { className: 'prr-live', role: 'status', 'aria-label': p.ariaLabel || 'Auto-refreshing' },
      h('span', { className: 'prr-live-dot', 'aria-hidden': true }), h('span', null, p.label || 'Live · updates every 5s'));
  }

  /* ---------- WhatsNew ---------- */
  function WhatsNew(p) {
    var s = useState(p.unread !== undefined ? p.unread : true), unread = s[0];
    var entries = p.entries || [];
    return h(Popover, { align: 'end', label: "What's new", defaultOpen: p.defaultOpen, className: 'prr-news',
      onOpenChange: function (o) { if (o && unread) { s[1](false); p.onSeen && p.onSeen(); } },
      trigger: h(P.Button, { variant: 'ghost', size: 'icon', className: 'prr-news-btn', 'aria-label': unread ? "What's new — unread updates" : "What's new" },
        h(Icon, { name: 'bell', size: 18 }), unread ? h('span', { className: 'prr-news-dot', 'aria-hidden': true }) : null) },
      h('div', { className: 'prr-news-head' }, h('p', { className: 'prr-news-title' }, "What's new"), h('p', { className: 'prr-hint' }, p.subtitle || 'Recent changes to the review pipeline')),
      h('div', { className: 'prr-news-body' }, entries.map(function (e, i) {
        return h('section', { key: e.version, className: 'prr-news-entry' },
          h('div', { className: 'prr-news-meta' }, h('span', { className: cx('prr-news-ver', i === 0 && 'is-latest') }, 'v' + e.version), h('span', null, e.date),
            i === 0 ? h(P.Badge, { variant: 'accent', style: { marginLeft: 'auto' } }, 'Latest') : null),
          h('p', { className: 'prr-news-entry-title' }, e.title),
          h('ul', { className: 'prr-news-list' }, (e.changes || []).map(function (c) { return h('li', { key: c }, c); })));
      })));
  }

  /* ---------- Avatar ---------- */
  function Avatar(p) {
    var size = p.size || 40, initial = ((p.name || '').trim().charAt(0) || '?').toUpperCase();
    var st = { width: size, height: size, fontSize: Math.round(size * 0.38) };
    if (p.src) return h('img', { className: cx('prr-avatar', p.className), src: p.src, alt: p.name || '', width: size, height: size, style: st });
    return h('span', { className: cx('prr-avatar prr-avatar--initial', p.tone && 'prr-avatar--' + p.tone, p.className), style: st, 'aria-hidden': true }, p.initials || initial);
  }

  /* ---------- AdminMenu ---------- */
  function AdminMenu(p) {
    var c = useState(false), confirm = c[0], setConfirm = c[1];
    var trig = h('button', { type: 'button', className: cx('prr-admin', p.collapsed && 'is-collapsed'), 'aria-label': 'Admin menu' },
      h(Avatar, { name: p.name || 'Admin', initials: p.initials || 'AD', size: 32, tone: 'accent' }),
      p.collapsed ? null : h('span', { className: 'prr-admin-text' }, h('span', { className: 'prr-admin-name' }, p.name || 'Admin'), h('span', { className: 'prr-admin-mail' }, p.email || 'admin@example.com')),
      p.collapsed ? null : h(Icon, { name: 'more' }));
    return h(React.Fragment, null,
      h(Popover, { trigger: trig, side: 'top', align: p.collapsed ? 'start' : 'end', label: 'Admin menu', wrapClassName: 'prr-admin-wrap', className: 'prr-admin-pop' }, function (close) {
        return h(React.Fragment, null,
          h('div', { className: 'prr-admin-theme' }, h('span', { className: 'prr-label' }, 'Theme'), h(ThemeToggle, null)),
          h('div', { className: 'prr-menu-sep', role: 'separator' }),
          h('button', { type: 'button', className: 'prr-menu-item prr-menu-item--destructive', onClick: function () { close(); setConfirm(true); } }, h(Icon, { name: 'logout' }), 'Log out'));
      }),
      h(P.ConfirmDialog, { open: confirm, onOpenChange: setConfirm, title: 'Log out of PR Reviewer?', description: 'You will be redirected to the login page.',
        confirmLabel: 'Log out', destructive: true, loading: p.loggingOut, onConfirm: function () { p.onLogout ? p.onLogout() : setConfirm(false); } }));
  }

  /* ---------- Sidebar ---------- */
  var DEFAULT_NAV = [
    { label: 'Dashboard', href: '/', icon: 'dashboard' }, { label: 'Requests', href: '/requests', icon: 'pr' },
    { label: 'AI Usage', href: '/usage', icon: 'chart' }, { label: 'Projects', href: '/projects', icon: 'folder' },
    { label: 'Settings', href: '/settings', icon: 'settings' }];
  function NavLink(p) {
    var it = p.item, active = p.active;
    var a = h('a', { href: it.href || '#', className: cx('prr-nav-link', active && 'is-active', p.collapsed && 'is-collapsed'), 'aria-current': active ? 'page' : undefined,
      onClick: function (e) { if (p.onNavigate) { e.preventDefault(); p.onNavigate(it); } } },
      ic(it.icon || 'dashboard', 18), p.collapsed ? h('span', { className: 'prr-sr' }, it.label) : h('span', null, it.label),
      it.badge != null && !p.collapsed ? h('span', { className: 'prr-nav-count' }, it.badge) : null);
    return p.collapsed ? h(P.Tooltip, { content: it.label, side: 'right' }, a) : a;
  }
  function Sidebar(p) {
    var s = useState(!!p.defaultCollapsed), collapsed = p.collapsed !== undefined ? p.collapsed : s[0];
    function setC(v) { if (p.collapsed === undefined) s[1](v); p.onCollapsedChange && p.onCollapsedChange(v); }
    var items = p.items || DEFAULT_NAV, activeHref = p.activeHref != null ? p.activeHref : '/';
    return h('aside', { className: cx('prr-sidebar', collapsed && 'is-collapsed', p.mobile && 'is-mobile', p.className), 'aria-label': 'Main navigation', style: p.style },
      h('div', { className: 'prr-sidebar-head' },
        h(BrandMark, { compact: collapsed, name: p.brandName }),
        p.mobile ? h(P.Button, { variant: 'ghost', size: 'icon', 'aria-label': 'Close navigation', onClick: p.onClose }, h(Icon, { name: 'x' })) :
          h(P.Tooltip, { content: collapsed ? 'Expand (⌘B)' : 'Collapse (⌘B)', side: 'right' },
            h('button', { type: 'button', className: 'prr-collapse', onClick: function () { setC(!collapsed); }, 'aria-label': collapsed ? 'Expand sidebar' : 'Collapse sidebar' },
              h(Icon, { name: collapsed ? 'chevronRight' : 'chevronLeft' })))),
      h('nav', { className: 'prr-nav' }, items.map(function (it) {
        return h(NavLink, { key: it.href, item: it, collapsed: collapsed, onNavigate: p.onNavigate,
          active: it.active != null ? it.active : (it.href === '/' ? activeHref === '/' : activeHref.indexOf(it.href) === 0) });
      })),
      h('div', { className: 'prr-sidebar-foot' }, p.footer !== undefined ? p.footer : h(AdminMenu, Object.assign({ collapsed: collapsed }, p.admin))));
  }

  /* ---------- Header ---------- */
  function Header(p) {
    return h('header', { className: cx('prr-header', p.className) },
      h(P.Button, { variant: 'ghost', size: 'icon', className: 'prr-header-menu', 'aria-label': 'Open navigation', onClick: p.onMenuClick }, h(Icon, { name: 'menu', size: 18 })),
      h('div', { className: 'prr-header-title' }, p.title ? h('h1', null, p.title) : null),
      h('div', { className: 'prr-header-actions' }, p.actions,
        p.changelog !== false ? h(WhatsNew, { entries: p.changelog || [], unread: p.unread }) : null,
        h(ThemeToggle, { theme: p.theme, onThemeChange: p.onThemeChange }),
        h(StatusDot, { status: p.status || 'healthy' })));
  }

  /* ---------- AppShell ---------- */
  function AppShell(p) {
    var c = useState(!!p.defaultCollapsed), collapsed = c[0], setCollapsed = c[1];
    var m = useState(false), mobile = m[0], setMobile = m[1];
    useEffect(function () {
      function key(e) { if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); setCollapsed(function (v) { return !v; }); } if (e.key === 'Escape') setMobile(false); }
      document.addEventListener('keydown', key); return function () { document.removeEventListener('keydown', key); };
    }, []);
    var sb = { items: p.navItems, activeHref: p.activeHref, onNavigate: function (it) { setMobile(false); p.onNavigate && p.onNavigate(it); }, admin: p.admin, brandName: p.brandName };
    return h('div', { className: cx('prr-shell', p.className), style: p.style },
      h(Sidebar, Object.assign({ collapsed: collapsed, onCollapsedChange: setCollapsed, className: 'prr-shell-side' }, sb)),
      mobile ? h('div', { className: 'prr-drawer', onMouseDown: function (e) { if (e.target === e.currentTarget) setMobile(false); } },
        h(Sidebar, Object.assign({ mobile: true, onClose: function () { setMobile(false); } }, sb))) : null,
      h('div', { className: 'prr-shell-main' },
        h(Header, { title: p.title, onMenuClick: function () { setMobile(true); }, status: p.status, changelog: p.changelog, actions: p.headerActions }),
        h('main', { className: 'prr-shell-content' }, h('div', { className: 'prr-shell-inner' }, p.children))));
  }

  /* ---------- PageHeader & SectionHeading ---------- */
  function PageHeader(p) {
    return h('div', { className: cx('prr-page-head', p.className) },
      p.onBack ? h(P.Button, { variant: 'secondary', size: 'icon', onClick: p.onBack, 'aria-label': p.backLabel || 'Back' }, h(Icon, { name: 'arrowLeft' })) : null,
      h('div', { className: 'prr-page-head-text' },
        p.kicker ? h('p', { className: 'prr-card-kicker' }, p.kicker) : null,
        h('div', { className: 'prr-page-title-row' }, h('h1', { className: 'prr-page-title' }, p.title), p.badge),
        p.description ? h('p', { className: 'prr-page-desc' }, p.description) : null),
      p.actions ? h('div', { className: 'prr-page-actions' }, p.actions) : null);
  }
  function SectionHeading(p) {
    return h('div', { className: cx('prr-section-head', p.className) },
      h(p.as || 'h2', { className: 'prr-section-title' }, p.children, p.count != null ? h('span', { className: 'prr-section-count' }, p.count) : null), p.action || null);
  }

  /* ---------- StatCard / SummaryCard ---------- */
  function StatCard(p) {
    if (p.loading) return h(P.Card, { className: 'prr-stat' }, h(P.Skeleton, { style: { width: 112, height: 14 } }), h(P.Skeleton, { style: { width: 80, height: 32, marginTop: 12 } }), h(P.Skeleton, { style: { width: 64, height: 10, marginTop: 12 } }));
    return h(P.Card, { hoverLift: p.hoverLift !== false, className: cx('prr-stat', p.tone && 'prr-stat--' + p.tone, p.className) },
      h('div', { className: 'prr-stat-top' }, h('span', { className: 'prr-stat-label' }, p.label), p.icon ? h('span', { className: 'prr-stat-icon', 'aria-hidden': true }, ic(p.icon, 16)) : null),
      h('p', { className: 'prr-stat-value' }, p.value),
      p.delta ? h('p', { className: cx('prr-stat-delta', p.delta.charAt(0) === '-' ? 'is-down' : 'is-up') }, p.delta.charAt(0) === '-' ? '▼ ' : '▲ ', p.delta.replace(/^[+-]/, ''), p.hint ? h('span', null, ' ' + p.hint) : null)
        : p.hint ? h('p', { className: 'prr-hint', style: { marginTop: 4 } }, p.hint) : null);
  }
  function SummaryCard(p) {
    if (p.loading) return h(P.Card, { className: 'prr-summary' }, h(P.Skeleton, { style: { width: 96, height: 12 } }), h(P.Skeleton, { style: { width: 72, height: 24, marginTop: 10 } }));
    return h(P.Card, { className: 'prr-summary' }, h('p', { className: 'prr-stat-label' }, p.label), h('p', { className: 'prr-summary-value' }, p.value));
  }

  /* ---------- BudgetMeter ---------- */
  function BudgetMeter(p) {
    var spent = p.spent || 0, limit = p.limit || 1, pct = Math.min(100, (spent / limit) * 100), over = spent > limit, warn = pct >= 80;
    var fmt = p.format || function (v) { return '$' + v.toFixed(2); };
    var tone = over ? 'error' : warn ? 'warning' : 'accent';
    return h('div', { className: cx('prr-budget', 'prr-budget--' + tone, p.className) },
      h('div', { className: 'prr-budget-head' }, h('span', { className: 'prr-label' }, p.label || 'Daily budget'),
        h('span', { className: 'prr-budget-nums' }, fmt(spent), h('span', null, ' / ' + fmt(limit))),
        over ? h(P.Badge, { variant: 'error' }, '✕ Over') : warn ? h(P.Badge, { variant: 'warning' }, '! ' + Math.round(pct) + '%') : h(P.Badge, { variant: 'neutral' }, Math.round(pct) + '%')),
      h('div', { className: 'prr-budget-track', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': limit, 'aria-valuenow': spent, 'aria-label': p.label || 'Daily budget' },
        h('span', { className: 'prr-budget-fill', style: { width: pct + '%' } })),
      over ? h('p', { className: 'prr-error', style: { marginTop: 8 } }, p.overMessage || 'Daily spend has exceeded the configured budget.') : null);
  }

  /* ---------- Attention ---------- */
  function AttentionItem(p) {
    var tone = p.tone || 'warning';
    return h('div', { className: cx('prr-attn', 'prr-attn--' + tone) },
      h('span', { className: 'prr-attn-icon', 'aria-hidden': true }, ic(p.icon || (tone === 'error' ? 'alert' : tone === 'neutral' ? 'wifiOff' : 'plug'), 16)),
      h('div', { className: 'prr-attn-body' },
        h('p', { className: 'prr-attn-title' }, p.title),
        p.tags && p.tags.length ? h('div', { className: 'prr-attn-tags' }, p.tags.map(function (t) { return h(P.Badge, { key: t, variant: tone === 'neutral' ? 'neutral' : tone }, t); })) : null,
        p.action ? h('a', { className: 'prr-link', href: p.action.href || '#', onClick: p.action.onClick }, p.action.label, ' →') : null));
  }
  function AttentionList(p) {
    var kids = React.Children.toArray(p.children);
    return kids.length ? h('div', { className: 'prr-attn-list' }, kids)
      : h('div', { className: 'prr-all-clear' }, h('span', { className: 'prr-all-clear-mark', 'aria-hidden': true }, h(Icon, { name: 'checkCheck' })), h('span', null, p.emptyText || 'All clear — no issues to address'));
  }

  /* ---------- States ---------- */
  function EmptyState(p) {
    return h('div', { className: cx('prr-empty', p.className) },
      h('span', { className: 'prr-empty-mark', 'aria-hidden': true }, ic(p.icon || 'search', 20)),
      h('p', { className: 'prr-empty-title' }, p.title || 'Nothing here yet'),
      p.description ? h('p', { className: 'prr-hint' }, p.description) : null, p.action || null);
  }
  function ErrorState(p) {
    return h('div', { className: cx('prr-errstate', p.className), role: 'alert' },
      h('span', { className: 'prr-errstate-mark', 'aria-hidden': true }, h(Icon, { name: 'alert', size: 18 })),
      h('div', { style: { flex: 1, minWidth: 0 } }, h('p', { className: 'prr-errstate-title' }, p.title || 'Could not load data'), p.message ? h('p', { className: 'prr-hint' }, p.message) : null),
      p.onRetry ? h(P.Button, { variant: 'secondary', size: 'sm', onClick: p.onRetry }, h(Icon, { name: 'refresh', size: 14 }), 'Retry') : null);
  }

  /* ---------- DataTable & Pagination ---------- */
  function Pagination(p) {
    var page = p.page || 1, total = p.totalPages || 1;
    return h('div', { className: cx('prr-pager', p.className) },
      h('p', { className: 'prr-pager-info' }, 'Page ' + page + ' of ' + total + (p.total != null ? ' · ' + p.total + ' total' : '')),
      h('div', { className: 'prr-pager-btns' },
        h(P.Button, { variant: 'secondary', size: 'sm', disabled: page <= 1, onClick: function () { p.onPageChange && p.onPageChange(page - 1); } }, h(Icon, { name: 'chevronLeft', size: 14 }), 'Previous'),
        h(P.Button, { variant: 'secondary', size: 'sm', disabled: page >= total, onClick: function () { p.onPageChange && p.onPageChange(page + 1); } }, 'Next', h(Icon, { name: 'chevronRight', size: 14 }))));
  }
  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var body;
    if (p.loading) body = Array.apply(null, Array(p.skeletonRows || 5)).map(function (_, i) {
      return h('tr', { key: 's' + i }, cols.map(function (c, j) { return h('td', { key: j }, h(P.Skeleton, { style: { width: j === 0 ? '70%' : '48px', height: 12 } })); }));
    });
    else if (!p.error && rows.length) body = rows.map(function (r, i) {
      return h('tr', { key: p.rowKey ? p.rowKey(r) : (r.id || i), className: p.onRowClick ? 'is-clickable' : undefined, onClick: p.onRowClick ? function () { p.onRowClick(r); } : undefined },
        cols.map(function (c) { return h('td', { key: c.key, className: cx(c.align === 'right' && 'is-right', c.mono && 'is-mono', c.muted && 'is-muted') }, c.render ? c.render(r) : r[c.key]); }));
    });
    return h('div', { className: cx('prr-table-card', p.className) },
      p.toolbar ? h('div', { className: 'prr-table-toolbar' }, p.toolbar) : null,
      h('div', { className: 'prr-table-scroll' },
        h('table', { className: 'prr-table', 'aria-busy': p.loading || undefined },
          p.caption ? h('caption', { className: 'prr-sr' }, p.caption) : null,
          h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { key: c.key, scope: 'col', className: c.align === 'right' ? 'is-right' : undefined, style: c.width ? { width: c.width } : undefined }, c.header); }))),
          body ? h('tbody', null, body) : null),
        !p.loading && p.error ? h('div', { className: 'prr-table-msg' }, h(ErrorState, { title: 'Could not load rows', message: p.error, onRetry: p.onRetry })) : null,
        !p.loading && !p.error && !rows.length ? h(EmptyState, { title: (p.empty && p.empty.title) || 'No rows found', description: p.empty && p.empty.description }) : null),
      p.footer ? h('div', { className: 'prr-table-foot' }, p.footer) : null);
  }

  /* ---------- DescriptionList, CodeBlock, Disclosure, FindingCard ---------- */
  function DescriptionList(p) {
    return h('div', { className: cx('prr-dl-wrap', p.className) },
      p.title ? h('h3', { className: 'prr-dl-title' }, p.title) : null,
      h('dl', { className: 'prr-dl' }, (p.items || []).map(function (it) {
        return h(React.Fragment, { key: it.term }, h('dt', null, it.term), h('dd', { className: it.mono ? 'is-mono' : undefined }, it.value));
      })));
  }
  function CodeBlock(p) {
    return h('div', { className: cx('prr-code', p.className) },
      p.label ? h('div', { className: 'prr-code-label' }, p.label) : null,
      h('pre', { style: p.maxHeight ? { maxHeight: p.maxHeight } : undefined }, p.children));
  }
  function Disclosure(p) {
    return h('details', { className: cx('prr-disclosure', p.className), open: p.defaultOpen },
      h('summary', null, h('span', { className: 'prr-disclosure-caret', 'aria-hidden': true }, h(Icon, { name: 'chevronRight', size: 14 })), p.summary),
      h('div', { className: 'prr-disclosure-body' }, p.children));
  }
  var SEV = { critical: 'error', major: 'error', minor: 'warning' };
  function FindingCard(p) {
    return h('article', { className: cx('prr-finding', 'prr-finding--' + (SEV[p.severity] || 'neutral'), p.className) },
      h('div', { className: 'prr-finding-head' },
        h(P.Badge, { variant: SEV[p.severity] || 'neutral' }, p.severity), p.category ? h(P.Badge, { variant: 'neutral' }, p.category) : null,
        p.location ? h('code', { className: 'prr-finding-loc' }, p.location) : null),
      h('p', { className: 'prr-finding-text' }, p.comment || p.children),
      p.suggestion ? h(CodeBlock, { label: 'Suggestion' }, p.suggestion) : null,
      p.blocking || p.posted ? h('div', { className: 'prr-finding-flags' }, p.blocking ? h('span', { className: 'is-blocking' }, '■ blocking') : null, p.posted ? h('span', { className: 'is-posted' }, '✓ posted') : null) : null);
  }

  /* ---------- Projects: AccountCard, RepoGroup, RepoRow, ProviderKeyRow ---------- */
  function AccountCard(p) {
    return h(P.Card, { hoverLift: true, className: 'prr-account' },
      h('div', { className: 'prr-account-top' },
        h(Avatar, { name: p.displayName || p.login, src: p.avatarUrl, tone: 'accent' }),
        h('div', { className: 'prr-account-id' },
          h('div', { className: 'prr-account-name-row' }, h('span', { className: 'prr-account-name' }, p.displayName),
            p.reconnectRequired ? h(P.Badge, { variant: 'warning' }, '! Reconnect required') : null),
          h('p', { className: 'prr-hint prr-mono' }, '@' + p.login)),
        h('div', { className: 'prr-account-side' }, h('span', { className: 'prr-mono prr-hint' }, p.repoCount + (p.repoCount === 1 ? ' repo' : ' repos')),
          h(P.Button, { variant: 'ghost', size: 'sm', loading: p.syncing, disabled: p.reconnectRequired || p.syncing, onClick: p.onResync, 'aria-label': 'Re-sync ' + p.login },
            p.syncing ? null : h(Icon, { name: 'refresh', size: 14 }), 'Re-sync'))),
      p.installations && p.installations.length ? h('div', { className: 'prr-chips' }, p.installations.map(function (i) {
        return h('a', { key: i.login, className: 'prr-chip', href: i.href || '#', target: '_blank', rel: 'noopener noreferrer' },
          h(Icon, { name: i.type === 'Organization' ? 'building' : 'user', size: 12 }), i.login);
      })) : null);
  }
  function RepoGroup(p) {
    return h('section', { className: 'prr-repo-group' },
      h('div', { className: 'prr-repo-group-head' }, h(Icon, { name: 'folder' }), h('span', null, p.title), h(P.Badge, null, p.count != null ? p.count : React.Children.count(p.children))),
      h('div', { className: 'prr-repo-rows' }, p.children));
  }
  function RepoRow(p) {
    return h('div', { className: cx('prr-repo-row', p.removed && 'is-removed') },
      h(Icon, { name: 'fork' }),
      h('div', { className: 'prr-repo-name' }, h('span', null, p.fullName), p.removed ? h(P.Badge, null, 'Removed') : null),
      p.lastEventAt ? h('time', { className: 'prr-repo-time' }, p.lastEventAt) : null,
      h(P.Switch, { checked: p.enabled, defaultChecked: p.enabled === undefined ? p.defaultEnabled : undefined, onCheckedChange: p.onEnabledChange,
        disabled: p.removed || p.toggling, 'aria-label': (p.enabled ? 'Disable ' : 'Enable ') + p.fullName }),
      h(P.Button, { variant: 'ghost', size: 'sm', disabled: p.removed, onClick: p.onConfigure, 'aria-label': 'Configure ' + p.fullName }, 'Configure'));
  }
  function ProviderKeyRow(p) {
    var s = useState(''), v = s[0];
    var label = p.label || (p.provider ? p.provider.charAt(0).toUpperCase() + p.provider.slice(1) : 'Provider');
    return h('div', { className: 'prr-key-row' },
      h('div', { className: 'prr-key-head' }, h('span', { className: 'prr-key-name' }, label), h(P.Badge, { variant: p.isSet ? 'success' : 'neutral' }, p.isSet ? '✓ Configured' : 'Not set')),
      h('div', { className: 'prr-key-input' },
        h(P.PasswordInput, { 'aria-label': label + ' API key', placeholder: p.isSet ? 'Enter new key to replace' : 'Enter API key', value: v, disabled: p.saving,
          onChange: function (e) { s[1](e.target.value); }, containerClassName: 'prr-grow' }),
        h(P.Button, { variant: 'secondary', loading: p.saving, disabled: !v.trim(), onClick: function () { p.onSave && p.onSave(v.trim()); s[1](''); } }, 'Save key')));
  }

  /* ---------- Charts (SVG, no library) ---------- */
  function useWidth(fallback) {
    var ref = useRef(null), s = useState(fallback || 480);
    useLayoutEffect(function () {
      var el = ref.current; if (!el) return;
      s[1](el.clientWidth || fallback || 480);
      if (!window.ResizeObserver) return;
      var ro = new ResizeObserver(function (e) { var w = Math.round(e[0].contentRect.width); if (w) s[1](w); });
      ro.observe(el); return function () { ro.disconnect(); };
    }, []);
    return [ref, s[0]];
  }
  function niceMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), n = v / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * e; }
  var TONE = { accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)', info: 'var(--info)', highlight: 'var(--highlight)', ink: 'var(--text)', neutral: 'var(--surface)' };
  var chartSeq = 0;
  function ChartLegend(p) {
    return h('ul', { className: 'prr-legend' }, (p.items || []).map(function (it) {
      return h('li', { key: it.label }, h('span', { className: cx('prr-legend-sw', it.hatch && 'is-hatch'), style: { background: TONE[it.tone] || it.tone } }), it.label,
        it.value != null ? h('b', null, it.value) : null);
    }));
  }
  function ChartTip(p) {
    if (!p.tip) return null;
    return h('div', { className: 'prr-chart-tip', style: { left: p.tip.x, top: p.tip.y } },
      h('p', { className: 'prr-chart-tip-title' }, p.tip.title), p.tip.rows.map(function (r) {
        return h('p', { key: r[0] }, h('span', { className: 'prr-legend-sw', style: { background: r[2] } }), r[0], h('b', null, r[1]));
      }));
  }
  function BarChart(p) {
    var wr = useWidth(480), ref = wr[0], W = wr[1], H = p.height || 240, t = useState(null), tip = t[0];
    var idr = useRef('bc' + (++chartSeq)), id = idr.current;
    var data = p.data || [], series = p.series || [{ key: 'value', label: 'Value', tone: 'accent' }], fmt = p.format || String;
    var padL = 36, padB = 24, padT = 8, iw = Math.max(10, W - padL - 4), ih = H - padB - padT;
    var max = niceMax(Math.max.apply(null, [0].concat(data.map(function (d) { return Math.max.apply(null, series.map(function (s) { return d[s.key] || 0; })); }))));
    var bw = iw / Math.max(1, data.length), gap = Math.max(4, bw * 0.22), sw = (bw - gap) / series.length;
    var ticks = [0, 0.2, 0.4, 0.6, 0.8, 1];
    return h('div', { className: 'prr-chart', ref: ref },
      h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Bar chart', onMouseLeave: function () { t[1](null); } },
        h('defs', null, h('pattern', { id: id + 'h', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, h('rect', { width: 6, height: 6, className: 'prr-hatch-bg' }), h('rect', { width: 2.5, height: 6, className: 'prr-hatch-ink' }))),
        ticks.map(function (k) { var y = padT + ih - ih * k; return h('g', { key: k }, h('line', { x1: padL, x2: W - 4, y1: y, y2: y, className: k ? 'prr-grid' : 'prr-axis' }), h('text', { x: padL - 6, y: y + 4, className: 'prr-tick', textAnchor: 'end' }, fmt(max * k))); }),
        data.map(function (d, i) {
          var x0 = padL + i * bw + gap / 2;
          return h('g', { key: i, onMouseEnter: function () { t[1]({ x: Math.min(W - 150, x0 + bw), y: 8, title: d.label, rows: series.map(function (s) { return [s.label, fmt(d[s.key] || 0), TONE[s.tone] || s.tone]; }) }); } },
            h('rect', { x: padL + i * bw, y: padT, width: bw, height: ih, className: 'prr-bar-hit' }),
            series.map(function (s, j) {
              var v = d[s.key] || 0, bh = ih * (v / max);
              return h('rect', { key: s.key, x: x0 + j * sw, y: padT + ih - bh, width: Math.max(1, sw - 2), height: bh, className: 'prr-bar', style: { fill: s.hatch ? 'url(#' + id + 'h)' : (TONE[s.tone] || s.tone), animationDelay: (i * 30) + 'ms' } });
            }),
            h('text', { x: padL + i * bw + bw / 2, y: H - 6, className: 'prr-tick', textAnchor: 'middle' }, d.label));
        })),
      h(ChartTip, { tip: tip }),
      p.legend !== false ? h(ChartLegend, { items: series }) : null);
  }
  function LineChart(p) {
    var wr = useWidth(480), ref = wr[0], W = wr[1], H = p.height || 240, t = useState(null), tip = t[0];
    var data = p.data || [], fmt = p.format || String, tone = TONE[p.tone || 'accent'];
    var padL = 48, padB = 24, padT = 10, iw = Math.max(10, W - padL - 10), ih = H - padB - padT;
    var max = niceMax(Math.max.apply(null, [0].concat(data.map(function (d) { return d.value; }))));
    var step = data.length > 1 ? iw / (data.length - 1) : 0;
    var pts = data.map(function (d, i) { return [padL + i * step, padT + ih - ih * (d.value / max)]; });
    var every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 56)));
    return h('div', { className: 'prr-chart', ref: ref },
      h('svg', { width: W, height: H, role: 'img', 'aria-label': p.ariaLabel || 'Line chart', onMouseLeave: function () { t[1](null); } },
        [0, 0.2, 0.4, 0.6, 0.8, 1].map(function (k) { var y = padT + ih - ih * k; return h('g', { key: k }, h('line', { x1: padL, x2: W - 10, y1: y, y2: y, className: k ? 'prr-grid' : 'prr-axis' }), h('text', { x: padL - 6, y: y + 4, className: 'prr-tick', textAnchor: 'end' }, fmt(max * k))); }),
        pts.length ? h('polyline', { points: pts.map(function (q) { return q.join(','); }).join(' '), className: 'prr-line', style: { stroke: tone }, pathLength: 1 }) : null,
        pts.map(function (q, i) {
          return h('g', { key: i, onMouseEnter: function () { t[1]({ x: Math.min(W - 150, q[0] + 8), y: Math.max(0, q[1] - 56), title: data[i].label, rows: [[p.seriesLabel || 'Value', fmt(data[i].value), tone]] }); } },
            h('rect', { x: q[0] - step / 2, y: padT, width: Math.max(step, 12), height: ih, className: 'prr-bar-hit' }),
            h('rect', { x: q[0] - 4, y: q[1] - 4, width: 8, height: 8, className: cx('prr-point', tip && tip.title === data[i].label && 'is-on') }),
            i % every === 0 ? h('text', { x: q[0], y: H - 6, className: 'prr-tick', textAnchor: 'middle' }, data[i].label) : null);
        })),
      h(ChartTip, { tip: tip }));
  }
  function DonutChart(p) {
    var data = p.data || [], total = data.reduce(function (a, d) { return a + d.value; }, 0) || 1, S = p.size || 200, r = S / 2 - 18, C = 2 * Math.PI * r, acc = 0;
    var hv = useState(null), hover = hv[0];
    return h('div', { className: 'prr-donut' },
      h('svg', { width: S, height: S, viewBox: '0 0 ' + S + ' ' + S, role: 'img', 'aria-label': p.ariaLabel || 'Donut chart' },
        h('circle', { cx: S / 2, cy: S / 2, r: r, className: 'prr-donut-track' }),
        data.map(function (d, i) {
          var len = C * d.value / total, off = acc; acc += len;
          return h('circle', { key: d.label, cx: S / 2, cy: S / 2, r: r, className: cx('prr-donut-seg', hover === i && 'is-on'),
            style: { stroke: TONE[d.tone] || d.tone, strokeDasharray: Math.max(0, len - 3) + ' ' + C, strokeDashoffset: -off, animationDelay: i * 60 + 'ms' },
            transform: 'rotate(-90 ' + S / 2 + ' ' + S / 2 + ')', onMouseEnter: function () { hv[1](i); }, onMouseLeave: function () { hv[1](null); } });
        }),
        h('text', { x: S / 2, y: S / 2 - 2, textAnchor: 'middle', className: 'prr-donut-num' }, hover != null ? data[hover].value : (p.centerValue != null ? p.centerValue : total)),
        h('text', { x: S / 2, y: S / 2 + 18, textAnchor: 'middle', className: 'prr-donut-cap' }, hover != null ? data[hover].label : (p.centerLabel || 'total'))),
      h(ChartLegend, { items: data.map(function (d) { return { label: d.label, tone: d.tone, value: Math.round(d.value / total * 100) + '%' }; }) }));
  }
  function ChartCard(p) {
    return h(P.Card, { className: cx('prr-chart-card', p.className) },
      h('div', { className: 'prr-chart-card-head' }, h('h2', { className: 'prr-section-title' }, p.title), p.actions || null), p.children);
  }

  /* ---------- LoginCard ---------- */
  function LoginCard(p) {
    return h(P.Card, { className: 'prr-login' },
      h('div', { className: 'prr-login-head' }, h('span', { className: 'prr-brand-mark is-lg', 'aria-hidden': true }, h(Icon, { name: 'pr', size: 24 })),
        h('h1', { className: 'prr-login-title' }, p.title || 'PR Reviewer'), h('p', { className: 'prr-hint' }, p.subtitle || 'Sign in to your dashboard')),
      h('form', { className: 'prr-login-form', noValidate: true, onSubmit: function (e) { e.preventDefault(); var f = e.currentTarget; p.onSubmit && p.onSubmit({ email: f.email.value, password: f.password.value }); } },
        h(P.Input, { label: 'Email', name: 'email', type: 'email', autoComplete: 'email', required: true, disabled: p.loading, defaultValue: p.defaultEmail }),
        h(P.PasswordInput, { label: 'Password', name: 'password', autoComplete: 'current-password', required: true, disabled: p.loading }),
        p.error ? h('p', { className: 'prr-error', role: 'alert' }, p.error) : null,
        h(P.Button, { type: 'submit', loading: p.loading, className: 'prr-w-full' }, p.loading ? 'Signing in…' : 'Sign in')));
  }

  Object.assign(window.PRR, {
    Icon: Icon, Popover: Popover, BrandMark: BrandMark, ThemeToggle: ThemeToggle, StatusDot: StatusDot, LiveIndicator: LiveIndicator,
    WhatsNew: WhatsNew, Avatar: Avatar, AdminMenu: AdminMenu, Sidebar: Sidebar, Header: Header, AppShell: AppShell,
    PageHeader: PageHeader, SectionHeading: SectionHeading, StatCard: StatCard, SummaryCard: SummaryCard, BudgetMeter: BudgetMeter,
    AttentionItem: AttentionItem, AttentionList: AttentionList, EmptyState: EmptyState, ErrorState: ErrorState,
    DataTable: DataTable, Pagination: Pagination, DescriptionList: DescriptionList, CodeBlock: CodeBlock, Disclosure: Disclosure, FindingCard: FindingCard,
    AccountCard: AccountCard, RepoGroup: RepoGroup, RepoRow: RepoRow, ProviderKeyRow: ProviderKeyRow,
    BarChart: BarChart, LineChart: LineChart, DonutChart: DonutChart, ChartLegend: ChartLegend, ChartCard: ChartCard, LoginCard: LoginCard,
    ICON_NAMES: Object.keys(ICONS)
  });
})();
