/* @ds-bundle: {"format":3,"namespace":"PaRoDesignSystem","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"MetricCard","sourcePath":"components/feedback/MetricCard.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"DataTable","sourcePath":"components/platform/DataTable.jsx"},{"name":"MaturityScale","sourcePath":"components/platform/MaturityScale.jsx"},{"name":"ModuleCard","sourcePath":"components/platform/ModuleCard.jsx"},{"name":"ScoreRing","sourcePath":"components/platform/ScoreRing.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"16222bda8e4b","components/core/Badge.jsx":"785b22fc8572","components/core/Button.jsx":"aa76d156d979","components/core/Card.jsx":"5500dd5d92b4","components/core/Tag.jsx":"c52125b8ee9c","components/feedback/Alert.jsx":"3022e059604c","components/feedback/MetricCard.jsx":"bcb043e5d63f","components/feedback/ProgressBar.jsx":"119f0f9c9f6f","components/forms/Input.jsx":"4ff9c0abfd93","components/forms/Select.jsx":"c09201adfc7d","components/navigation/SidebarNav.jsx":"7d94734f3b6e","components/navigation/Tabs.jsx":"a1ba777ea450","components/platform/DataTable.jsx":"46a0074cb920","components/platform/MaturityScale.jsx":"ffb43d30082f","components/platform/ModuleCard.jsx":"4ba943ad0c15","components/platform/ScoreRing.jsx":"ceea63e2806c","ui_kits/platform/AssessmentScreen.jsx":"8c0da62fdcd2","ui_kits/platform/ConfigureScreen.jsx":"da8c8bad1ecc","ui_kits/platform/Icon.jsx":"b7ca16485691","ui_kits/platform/ScoreCardScreen.jsx":"29f89c3f976b","ui_kits/platform/SemanticStudioScreen.jsx":"ec2a2e553ad4","ui_kits/platform/Shell.jsx":"4d4ad5809210"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PaRoDesignSystem = window.PaRoDesignSystem || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  blue: {
    background: 'var(--hex-blue-light)',
    color: 'var(--hex-blue)'
  },
  bright: {
    background: 'var(--hex-bright-dim)',
    color: '#0D5FAD'
  },
  electric: {
    background: 'var(--hex-electric-dim)',
    color: '#0A8A98'
  },
  honey: {
    background: 'var(--hex-honey-dim)',
    color: '#7A5300'
  },
  success: {
    background: 'var(--success-dim)',
    color: '#0A7040'
  },
  neutral: {
    background: 'var(--gray-100)',
    color: 'var(--gray-600)'
  }
};
const sizes = {
  sm: 32,
  md: 48,
  lg: 64
};

/**
 * Avatar — persona initials chip. Consistent color per persona/role.
 */
function Avatar({
  initials,
  tone = 'blue',
  size = 'md',
  style = {},
  ...props
}) {
  const px = sizes[size] || sizes.md;
  const base = {
    width: px,
    height: px,
    borderRadius: 'var(--r-full)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontSize: px <= 32 ? 'var(--text-xs)' : 'var(--text-sm)',
    fontWeight: 700,
    flexShrink: 0,
    ...tones[tone],
    ...style
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: base
  }, props), initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const variants = {
  blue: {
    background: 'var(--hex-blue-light)',
    color: 'var(--hex-blue)'
  },
  bright: {
    background: 'var(--hex-bright-dim)',
    color: '#0D5FAD'
  },
  electric: {
    background: 'var(--hex-electric-dim)',
    color: '#0A8A98'
  },
  honey: {
    background: 'var(--hex-honey-dim)',
    color: '#AA6E00'
  },
  success: {
    background: 'var(--success-dim)',
    color: '#0A7040'
  },
  warning: {
    background: 'var(--warning-dim)',
    color: '#AA6E00'
  },
  danger: {
    background: 'var(--danger-dim)',
    color: '#A82030'
  },
  neutral: {
    background: 'var(--gray-100)',
    color: 'var(--gray-600)'
  }
};

/**
 * Badge — communicates status, category, or count. Never decorative.
 */
function Badge({
  variant = 'neutral',
  dot = false,
  children,
  style = {},
  ...props
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: 'var(--r-full)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    letterSpacing: '0.02em',
    lineHeight: 1.4,
    ...variants[variant],
    ...style
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: base
  }, props), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizeStyles = {
  sm: {
    padding: '6px 14px',
    fontSize: 'var(--text-xs)'
  },
  md: {
    padding: '9px 18px',
    fontSize: 'var(--text-sm)'
  },
  lg: {
    padding: '12px 24px',
    fontSize: 'var(--text-md)'
  }
};
const variantStyles = {
  primary: {
    background: 'var(--hex-blue)',
    color: '#fff',
    border: '1px solid transparent'
  },
  secondary: {
    background: '#fff',
    color: 'var(--hex-blue)',
    border: '1px solid var(--hex-blue)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--gray-600)',
    border: '1px solid var(--gray-300)'
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff',
    border: '1px solid transparent'
  }
};
const hoverBg = {
  primary: 'var(--hex-blue-dark)',
  secondary: 'var(--hex-blue-light)',
  ghost: 'var(--gray-100)',
  danger: '#C32A39'
};

/**
 * Button — the platform's primary action control.
 * One primary action per view; ghost for secondary; danger only for
 * destructive, irreversible actions.
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  iconLeft = null,
  iconRight = null,
  children,
  style = {},
  ...props
}) {
  const [hover, setHover] = React.useState(false);
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-2)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    lineHeight: 1,
    borderRadius: 'var(--r-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background var(--ease), border-color var(--ease), color var(--ease)',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(hover && !disabled ? {
      background: hoverBg[variant]
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    style: base,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, props), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — the primary content container.
 */
function Card({
  title,
  subtitle,
  children,
  padding = 'var(--sp-6)',
  style = {},
  ...props
}) {
  const base = {
    background: 'var(--surface-card)',
    borderRadius: 'var(--r-xl)',
    border: '1px solid var(--border-default)',
    padding,
    boxShadow: 'var(--shadow-sm)',
    fontFamily: 'var(--font-sans)',
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: base
  }, props), (title || subtitle) && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: children ? 'var(--sp-4)' : 0
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 700,
      color: 'var(--gray-900)',
      marginBottom: subtitle ? 'var(--sp-1)' : 0
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--gray-500)'
    }
  }, subtitle)), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tag — a user-applied label / chip. Neutral by default.
 */
function Tag({
  children,
  onRemove,
  style = {},
  ...props
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--sp-1)',
    padding: '4px 12px',
    borderRadius: 'var(--r-full)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    background: 'var(--gray-100)',
    color: 'var(--gray-600)',
    border: '1px solid var(--gray-200)',
    ...style
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: base
  }, props), children, onRemove && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    "aria-label": "Remove",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--gray-400)',
      padding: 0,
      lineHeight: 1,
      fontSize: 14
    }
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  info: {
    background: 'var(--info-dim)',
    border: 'var(--info)',
    color: '#0D5FAD',
    symbol: 'ℹ'
  },
  success: {
    background: 'var(--success-dim)',
    border: 'var(--success)',
    color: '#0A7040',
    symbol: '✓'
  },
  warning: {
    background: 'var(--warning-dim)',
    border: 'var(--warning)',
    color: '#7A5300',
    symbol: '⚠'
  },
  danger: {
    background: 'var(--danger-dim)',
    border: 'var(--danger)',
    color: '#8B1A26',
    symbol: '✕'
  }
};

/**
 * Alert — contextual feedback. Always a bold title + one concise sentence.
 */
function Alert({
  tone = 'info',
  title,
  children,
  icon,
  style = {},
  ...props
}) {
  const t = tones[tone];
  const base = {
    display: 'flex',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-4)',
    borderRadius: 'var(--r-lg)',
    borderLeft: `4px solid ${t.border}`,
    background: t.background,
    color: t.color,
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.5,
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "alert",
    style: base
  }, props), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      flexShrink: 0,
      marginTop: 1,
      lineHeight: 1.2
    }
  }, icon || t.symbol), /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("strong", {
    style: {
      fontWeight: 700,
      display: 'block',
      marginBottom: 2
    }
  }, title), children));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/MetricCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const trendColors = {
  blue: 'var(--hex-blue)',
  electric: 'var(--hex-electric)',
  honey: 'var(--hex-honey)',
  success: 'var(--success)',
  danger: 'var(--danger)'
};

/**
 * MetricCard — surfaces a single KPI with delta and a trend bar.
 */
function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaDir = 'up',
  trendPct,
  color = 'blue',
  valueColor,
  style = {},
  ...props
}) {
  const base = {
    background: 'var(--surface-card)',
    borderRadius: 'var(--r-xl)',
    border: '1px solid var(--border-default)',
    padding: 'var(--sp-5)',
    boxShadow: 'var(--shadow-sm)',
    fontFamily: 'var(--font-sans)',
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: base
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)',
      marginBottom: 'var(--sp-2)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 800,
      color: valueColor || 'var(--gray-900)',
      lineHeight: 1,
      letterSpacing: '-0.02em'
    }
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      color: 'var(--gray-400)',
      fontWeight: 700
    }
  }, unit)), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      marginTop: 'var(--sp-2)',
      color: deltaDir === 'down' ? 'var(--danger)' : 'var(--success)'
    }
  }, deltaDir === 'down' ? '↓' : '↑', " ", delta), typeof trendPct === 'number' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--sp-3)',
      height: 4,
      background: 'var(--gray-100)',
      borderRadius: 'var(--r-full)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${trendPct}%`,
      background: trendColors[color],
      borderRadius: 'var(--r-full)'
    }
  })));
}
Object.assign(__ds_scope, { MetricCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/MetricCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const colors = {
  blue: 'var(--hex-blue)',
  electric: 'var(--hex-electric)',
  honey: 'var(--hex-honey)',
  success: 'var(--success)',
  danger: 'var(--danger)'
};

/**
 * ProgressBar — section score / progress with optional label + value.
 * Assessment section scores show numeric value, never an M-level label.
 */
function ProgressBar({
  label,
  value,
  max = 100,
  color = 'blue',
  showValue = true,
  height = 8,
  suffix = '',
  style = {},
  ...props
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), (label || showValue) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 'var(--sp-2)'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--gray-700)'
    }
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--hex-blue)'
    }
  }, value, suffix)), /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      background: 'var(--gray-100)',
      borderRadius: 'var(--r-full)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: colors[color],
      borderRadius: 'var(--r-full)',
      transition: 'width var(--ease-spring)'
    }
  })));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — text field with label, hint, and error states.
 * Every input must have a visible label — never rely on placeholder alone.
 */
function Input({
  label,
  hint,
  error,
  iconLeft,
  id,
  style = {},
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || React.useId();
  const field = {
    width: '100%',
    padding: iconLeft ? '9px 12px 9px 36px' : '9px 12px',
    borderRadius: 'var(--r-md)',
    border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--hex-blue)' : 'var(--gray-300)'}`,
    boxShadow: focus && !error ? '0 0 0 3px var(--focus-ring)' : 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    color: 'var(--gray-800)',
    outline: 'none',
    transition: 'border-color var(--ease), box-shadow var(--ease)',
    ...style
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-1)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--gray-700)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--gray-400)',
      display: 'flex',
      pointerEvents: 'none'
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    style: field,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, props))), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--danger)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--gray-400)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Select — labeled dropdown matching Input styling.
 */
function Select({
  label,
  hint,
  error,
  children,
  id,
  style = {},
  ...props
}) {
  const [focus, setFocus] = React.useState(false);
  const selectId = id || React.useId();
  const chevron = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239BA3AD' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E";
  const field = {
    width: '100%',
    padding: '9px 36px 9px 12px',
    borderRadius: 'var(--r-md)',
    border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--hex-blue)' : 'var(--gray-300)'}`,
    boxShadow: focus && !error ? '0 0 0 3px var(--focus-ring)' : 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
    color: 'var(--gray-800)',
    outline: 'none',
    appearance: 'none',
    background: `#fff url("${chevron}") no-repeat right 12px center`,
    transition: 'border-color var(--ease), box-shadow var(--ease)',
    ...style
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-1)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selectId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--gray-700)'
    }
  }, label), /*#__PURE__*/React.createElement("select", _extends({
    id: selectId,
    style: field,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }, props), children), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--danger)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--gray-400)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SidebarNav — the platform's fixed left module navigation.
 * Active item = blue tint fill + filled icon chip.
 */
function SidebarNav({
  brand = 'AI-Ready Data Platform',
  items = [],
  value,
  onChange,
  style = {},
  ...props
}) {
  const [internal, setInternal] = React.useState(value ?? (items[0] && items[0].id));
  const active = value !== undefined ? value : internal;
  const select = id => {
    if (value === undefined) setInternal(id);
    onChange && onChange(id);
  };
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-xl)',
      padding: 'var(--sp-3)',
      width: 220,
      boxShadow: 'var(--shadow-sm)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--sp-3) var(--sp-3) var(--sp-4)',
      borderBottom: '1px solid var(--gray-200)',
      marginBottom: 'var(--sp-3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 800,
      color: 'var(--hex-blue)',
      letterSpacing: '-0.01em'
    }
  }, brand)), items.map(it => {
    if (it.divider) return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      style: {
        height: 1,
        background: 'var(--gray-200)',
        margin: 'var(--sp-2) 0'
      }
    });
    const isActive = it.id === active;
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      onClick: () => select(it.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-2) var(--sp-3)',
        borderRadius: 'var(--r-md)',
        fontSize: 'var(--text-sm)',
        fontWeight: isActive ? 700 : 500,
        color: isActive ? 'var(--hex-blue)' : 'var(--gray-600)',
        background: isActive ? 'var(--hex-blue-light)' : 'transparent',
        cursor: 'pointer',
        transition: 'all var(--ease)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 20,
        height: 20,
        borderRadius: 'var(--r-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        flexShrink: 0,
        background: isActive ? 'var(--hex-blue)' : 'var(--gray-100)',
        color: isActive ? '#fff' : 'var(--gray-500)'
      }
    }, it.icon), it.label);
  }));
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tabs — sub-navigation strip within a module. Active = Primary Blue
 * label + underline.
 */
function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  style = {},
  ...props
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? (tabs[0] && tabs[0].id));
  const active = value !== undefined ? value : internal;
  const select = id => {
    if (value === undefined) setInternal(id);
    onChange && onChange(id);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderBottom: '1px solid var(--gray-200)',
      display: 'flex',
      gap: 0,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), tabs.map(t => {
    const isActive = t.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => select(t.id),
      style: {
        padding: 'var(--sp-3) var(--sp-5)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        color: isActive ? 'var(--hex-blue)' : 'var(--gray-500)',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${isActive ? 'var(--hex-blue)' : 'transparent'}`,
        marginBottom: -1,
        cursor: 'pointer',
        transition: 'color var(--ease)',
        whiteSpace: 'nowrap'
      }
    }, t.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/platform/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * DataTable — structured data with a Primary Blue header, zebra rows,
 * and a hover highlight. Pass plain column defs + row objects.
 */
function DataTable({
  columns = [],
  rows = [],
  style = {},
  ...props
}) {
  const [hover, setHover] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      overflowX: 'auto',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border-default)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      background: 'var(--hex-blue)',
      color: '#fff',
      fontWeight: 700,
      padding: 'var(--sp-3) var(--sp-4)',
      textAlign: c.align || 'left',
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(-1)
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      padding: 'var(--sp-3) var(--sp-4)',
      borderTop: '1px solid var(--gray-100)',
      color: 'var(--gray-700)',
      textAlign: c.align || 'left',
      background: hover === i ? 'var(--hex-blue-light)' : i % 2 ? 'var(--gray-50)' : '#fff',
      transition: 'background var(--ease)'
    }
  }, c.render ? c.render(row[c.key], row) : row[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/platform/MaturityScale.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DEFAULT_STEPS = [{
  code: 'M1',
  label: 'Aware'
}, {
  code: 'M2',
  label: 'Experimenting'
}, {
  code: 'M3',
  label: 'Scaling'
}, {
  code: 'M4',
  label: 'Optimising'
}, {
  code: 'M5',
  label: 'Leading'
}];
const depths = ['var(--m1)', 'var(--m2)', 'var(--m3)', 'var(--m4)', 'var(--m5)'];

/**
 * MaturityScale — the M1–M5 placement bar. Blue deepens with maturity;
 * a honey underline marks the current level.
 */
function MaturityScale({
  current = 3,
  steps = DEFAULT_STEPS,
  style = {},
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 0,
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), steps.map((s, i) => {
    const isCurrent = i + 1 === current;
    return /*#__PURE__*/React.createElement("div", {
      key: s.code,
      style: {
        flex: 1,
        padding: 'var(--sp-4) var(--sp-3)',
        textAlign: 'center',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        color: isCurrent ? '#fff' : 'rgba(255,255,255,0.6)',
        background: depths[i] || depths[depths.length - 1],
        borderRight: i < steps.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-lg)',
        fontWeight: 800,
        display: 'block',
        marginBottom: 2
      }
    }, s.code), s.label, isCurrent && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'var(--hex-honey)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { MaturityScale });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/MaturityScale.jsx", error: String((e && e.message) || e) }); }

// components/platform/ModuleCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const accents = {
  blue: {
    bg: 'var(--hex-blue-light)',
    fg: 'var(--hex-blue)'
  },
  bright: {
    bg: 'var(--hex-bright-dim)',
    fg: 'var(--hex-bright)'
  },
  electric: {
    bg: 'var(--hex-electric-dim)',
    fg: '#0A8A98'
  },
  honey: {
    bg: 'var(--hex-honey-dim)',
    fg: 'var(--hex-honey)'
  }
};

/**
 * ModuleCard — platform-home tile for a module. Each module owns a
 * distinct accent color from the brand palette.
 */
function ModuleCard({
  icon,
  name,
  description,
  accent = 'blue',
  footer,
  style = {},
  ...props
}) {
  const a = accents[accent];
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: 'var(--r-xl)',
      padding: 'var(--sp-5)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 'var(--sp-3)',
      background: a.bg,
      color: a.fg
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 700,
      color: 'var(--gray-900)',
      marginBottom: 4
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--gray-500)',
      lineHeight: 1.5
    }
  }, description), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--sp-3)',
      display: 'flex',
      gap: 'var(--sp-2)',
      flexWrap: 'wrap'
    }
  }, footer));
}
Object.assign(__ds_scope, { ModuleCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ModuleCard.jsx", error: String((e && e.message) || e) }); }

// components/platform/ScoreRing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ScoreRing — circular gauge for the AI Readiness Index or any 0–max score.
 */
function ScoreRing({
  value = 0,
  max = 100,
  size = 100,
  stroke = 10,
  color = 'var(--hex-blue)',
  sublabel = `/ ${100}`,
  style = {},
  ...props
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: size,
      height: size,
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--gray-100)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: `${circ * pct} ${circ}`,
    style: {
      transition: 'stroke-dasharray var(--ease-spring)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xl)',
      fontWeight: 800,
      color: 'var(--gray-900)',
      lineHeight: 1
    }
  }, value), sublabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--gray-400)',
      fontWeight: 600
    }
  }, sublabel)));
}
Object.assign(__ds_scope, { ScoreRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/platform/ScoreRing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/AssessmentScreen.jsx
try { (() => {
/* global React, Icon */
const {
  Tabs,
  Card,
  Button,
  Badge,
  Avatar,
  ProgressBar,
  Alert
} = window.DS;
const QUESTIONS = [{
  persona: {
    initials: 'DG',
    tone: 'electric',
    role: 'Governance Lead'
  },
  section: 'Stage 1 — Data Governance',
  text: 'How is ownership assigned for critical data domains?',
  options: ['No formal ownership — domains are unassigned', 'Ownership is informal and undocumented', 'Documented owners exist for most critical domains', 'Every domain has an accountable owner with an SLA']
}, {
  persona: {
    initials: 'EA',
    tone: 'bright',
    role: 'Data Architect'
  },
  section: 'Stage 1 — Data Foundation',
  text: 'What proportion of data assets have end-to-end lineage captured?',
  options: ['None — lineage is not tracked', 'Lineage exists for a few key pipelines', 'Most production assets have lineage', 'Lineage is automated across the estate']
}, {
  persona: {
    initials: 'CI',
    tone: 'honey',
    role: 'CISO'
  },
  section: 'Stage 2 — Security & Privacy',
  text: 'How is sensitive data classified before AI consumption?',
  options: ['No classification process exists', 'Manual classification on request', 'Automated classification for most sources', 'Continuous classification with policy enforcement']
}];
function AssessmentScreen() {
  const [tab, setTab] = React.useState('s1');
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const q = QUESTIONS[idx];
  const answered = answers[idx];
  const completed = Object.keys(answers).length;
  const pct = Math.round(completed / QUESTIONS.length * 100);
  const choose = i => setAnswers(a => ({
    ...a,
    [idx]: i
  }));
  const next = () => setIdx(i => Math.min(i + 1, QUESTIONS.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));
  const done = completed === QUESTIONS.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: 'var(--gray-900)',
      marginBottom: 4
    }
  }, "Assessment"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--gray-500)'
    }
  }, "Persona-routed diagnostic. Answers feed the maturity engine \u2014 section scores are numeric; the M-level appears only on the summary.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border-default)',
      padding: '8px 24px 0',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      id: 's1',
      label: 'Stage 1 — Readiness'
    }, {
      id: 's2',
      label: 'Stage 2 — Compliance'
    }, {
      id: 'hist',
      label: 'History'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.7fr 1fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: q.persona.initials,
    tone: q.persona.tone,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)'
    }
  }, q.section), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--gray-400)'
    }
  }, "Routed to ", q.persona.role)), /*#__PURE__*/React.createElement(Badge, {
    variant: "neutral"
  }, "Question ", idx + 1, " / ", QUESTIONS.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: 'var(--gray-900)',
      marginBottom: 18,
      lineHeight: 1.3
    }
  }, q.text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, q.options.map((opt, i) => {
    const on = answered === i;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => choose(i),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--r-md)',
        border: `1px solid ${on ? 'var(--hex-blue)' : 'var(--gray-300)'}`,
        background: on ? 'var(--hex-blue-light)' : '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        color: on ? 'var(--hex-blue)' : 'var(--gray-700)',
        fontWeight: on ? 600 : 500,
        transition: 'all var(--ease)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${on ? 'var(--hex-blue)' : 'var(--gray-300)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--hex-blue)'
      }
    })), opt);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: prev,
    disabled: idx === 0,
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-left",
      size: 15
    })
  }, "Back"), idx < QUESTIONS.length - 1 ? /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: next,
    disabled: answered === undefined,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 15
    })
  }, "Next") : /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: !done,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 15
    })
  }, "Submit assessment"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)',
      marginBottom: 14
    }
  }, "Completion"), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Answered",
    value: completed,
    max: QUESTIONS.length,
    suffix: ` / ${QUESTIONS.length}`,
    height: 10
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Data Governance",
    value: 82,
    suffix: "/100"
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Data Foundation",
    value: 68,
    color: "electric",
    suffix: "/100"
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Security & Privacy",
    value: 76,
    color: "success",
    suffix: "/100"
  }))), done ? /*#__PURE__*/React.createElement(Alert, {
    tone: "success",
    title: "All sections complete"
  }, "Submit to run the scoring engine. Results arrive within a few minutes.") : /*#__PURE__*/React.createElement(Alert, {
    tone: "info",
    title: `${QUESTIONS.length - completed} questions pending`
  }, "Scores stay provisional until every routed question is answered."))));
}
window.AssessmentScreen = AssessmentScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/AssessmentScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/ConfigureScreen.jsx
try { (() => {
/* global React, Icon */
const {
  Card,
  Badge,
  Avatar,
  Button
} = window.DS;
const PERSONAS = [{
  initials: 'CD',
  tone: 'blue',
  role: 'CDO',
  access: [2, 2, 1, 1]
}, {
  initials: 'EA',
  tone: 'bright',
  role: 'Data Architect',
  access: [1, 1, 2, 1]
}, {
  initials: 'DG',
  tone: 'electric',
  role: 'Governance Lead',
  access: [1, 1, 2, 0]
}, {
  initials: 'CI',
  tone: 'honey',
  role: 'CISO / Privacy',
  access: [1, 1, 1, 1]
}, {
  initials: 'AI',
  tone: 'success',
  role: 'Head of AI/ML',
  access: [1, 1, 1, 0]
}, {
  initials: 'FO',
  tone: 'neutral',
  role: 'FinOps Lead',
  access: [1, 0, 0, 1]
}];
const MODULES = ['Score Card', 'Assessment', 'Semantic Studio', 'Configure'];
const dotColor = ['var(--gray-200)', 'var(--hex-electric)', 'var(--hex-blue)'];
const CONNECTORS = [{
  name: 'Enterprise Data Warehouse',
  status: 'Connected',
  icon: 'database'
}, {
  name: 'Object Storage — Unstructured',
  status: 'Connected',
  icon: 'folder'
}, {
  name: 'Identity & Access Provider',
  status: 'Connected',
  icon: 'key-round'
}, {
  name: 'Operational Telemetry',
  status: 'Syncing',
  icon: 'activity'
}];
function ConfigureScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: 'var(--gray-900)',
      marginBottom: 4
    }
  }, "Configure"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--gray-500)'
    }
  }, "Platform administration \u2014 personas, access, connectors and thresholds.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)'
    }
  }, "Feature access matrix"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    })
  }, "Add persona")), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--border-default)',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: {
      background: 'var(--gray-800)',
      color: '#fff',
      textAlign: 'left',
      padding: '10px 16px',
      fontWeight: 600,
      minWidth: 200
    }
  }, "Persona"), MODULES.map(m => /*#__PURE__*/React.createElement("th", {
    key: m,
    style: {
      background: 'var(--gray-800)',
      color: '#fff',
      padding: '10px 16px',
      fontWeight: 600,
      textAlign: 'center'
    }
  }, m)))), /*#__PURE__*/React.createElement("tbody", null, PERSONAS.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.role
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 16px',
      borderTop: '1px solid var(--gray-100)',
      background: 'var(--gray-50)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: p.initials,
    tone: p.tone,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--gray-700)'
    }
  }, p.role))), p.access.map((a, i) => /*#__PURE__*/React.createElement("td", {
    key: i,
    style: {
      padding: '10px 16px',
      borderTop: '1px solid var(--gray-100)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: dotColor[a]
    }
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      marginTop: 12,
      fontSize: 13,
      color: 'var(--gray-500)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: dotColor[2]
    }
  }), "Full access"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: dotColor[1]
    }
  }), "Scoped / partial"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: dotColor[0]
    }
  }), "No access"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)',
      marginBottom: 14
    }
  }, "Connectors"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16
    }
  }, CONNECTORS.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.name,
    padding: "var(--sp-4)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-md)',
      background: 'var(--gray-100)',
      color: 'var(--gray-600)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: c.icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--gray-900)'
    }
  }, c.name)), /*#__PURE__*/React.createElement(Badge, {
    variant: c.status === 'Connected' ? 'success' : 'warning',
    dot: true
  }, c.status)))))));
}
window.ConfigureScreen = ConfigureScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/ConfigureScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Icon.jsx
try { (() => {
/* global React, lucide */
// Icon — thin wrapper over Lucide. Renders an <i data-lucide> and
// (re)hydrates the SVG after mount. currentColor + 2px stroke.
function Icon({
  name,
  size = 18,
  color,
  style = {},
  strokeWidth = 2
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', name);
      ref.current.appendChild(i);
      window.lucide.createIcons({
        attrs: {
          width: size,
          height: size,
          'stroke-width': strokeWidth
        },
        nameAttr: 'data-lucide'
      });
    }
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: 'inline-flex',
      color,
      lineHeight: 0,
      ...style
    }
  });
}
window.Icon = Icon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Icon.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/ScoreCardScreen.jsx
try { (() => {
/* global React, Icon */
const {
  MetricCard,
  ScoreRing,
  ProgressBar,
  MaturityScale,
  DataTable,
  Badge,
  Card
} = window.DS;
function SectionLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gray-400)',
      margin: '0 0 14px'
    }
  }, children);
}
function ScoreCardScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: 'var(--gray-900)',
      marginBottom: 4
    }
  }, "AI Readiness \u2014 Score Card"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--gray-500)'
    }
  }, "Live readiness across governance, foundation, enablement and security. Last calculated 2 hours ago.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(MetricCard, {
    label: "AI Readiness Index",
    value: 73,
    valueColor: "var(--hex-blue)",
    delta: "+6 pts this month",
    trendPct: 73
  }), /*#__PURE__*/React.createElement(MetricCard, {
    label: "Assets AI-ready",
    value: "1,284",
    delta: "142 new this week",
    trendPct: 58,
    color: "electric"
  }), /*#__PURE__*/React.createElement(MetricCard, {
    label: "Trust score",
    value: 81,
    valueColor: "var(--success)",
    delta: "Stable",
    trendPct: 81,
    color: "success"
  }), /*#__PURE__*/React.createElement(MetricCard, {
    label: "Open violations",
    value: 7,
    valueColor: "var(--danger)",
    delta: "2 unresolved > 14 days",
    deltaDir: "down",
    trendPct: 24,
    color: "danger"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.3fr',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "Composite index"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(ScoreRing, {
    value: 73,
    sublabel: "/ 100",
    size: 108
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Governance",
    value: 82
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Infrastructure",
    value: 68,
    color: "electric"
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Data quality",
    value: 75,
    color: "success"
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Access",
    value: 61,
    color: "honey"
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "Maturity placement"), /*#__PURE__*/React.createElement(MaturityScale, {
    current: 3
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gray-500)',
      marginTop: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 15,
    color: "var(--hex-blue)"
  }), "Meridian Corp is placed at ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--gray-800)'
    }
  }, "M3 \u2014 Scaling"), ". Reaching M4 requires lifting Observability above 60."))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "Dimension scores"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '14px 48px'
    }
  }, /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Data Governance",
    value: 82,
    suffix: "/100",
    height: 10
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Security & Privacy",
    value: 76,
    color: "success",
    suffix: "/100",
    height: 10
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Data Foundation",
    value: 68,
    color: "electric",
    suffix: "/100",
    height: 10
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "AI Enablement",
    value: 55,
    color: "honey",
    suffix: "/100",
    height: 10
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "Observability",
    value: 43,
    color: "danger",
    suffix: "/100",
    height: 10
  }), /*#__PURE__*/React.createElement(ProgressBar, {
    label: "FinOps",
    value: 64,
    color: "electric",
    suffix: "/100",
    height: 10
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionLabel, null, "Data assets"), /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: 'asset',
      header: 'Data asset'
    }, {
      key: 'domain',
      header: 'Domain'
    }, {
      key: 'status',
      header: 'AI-ready status',
      render: v => /*#__PURE__*/React.createElement(Badge, {
        variant: v === 'AI-ready' ? 'success' : v === 'In progress' ? 'warning' : 'danger',
        dot: true
      }, v)
    }, {
      key: 'trust',
      header: 'Trust score',
      align: 'right'
    }, {
      key: 'refreshed',
      header: 'Last refreshed',
      align: 'right'
    }],
    rows: [{
      asset: 'customer_transactions',
      domain: 'Finance',
      status: 'AI-ready',
      trust: 91,
      refreshed: '2h ago'
    }, {
      asset: 'product_catalogue',
      domain: 'Commerce',
      status: 'AI-ready',
      trust: 84,
      refreshed: '6h ago'
    }, {
      asset: 'hr_employee_records',
      domain: 'People',
      status: 'In progress',
      trust: 62,
      refreshed: '1d ago'
    }, {
      asset: 'ops_sensor_data',
      domain: 'Operations',
      status: 'Blocked',
      trust: 38,
      refreshed: '4d ago'
    }]
  })));
}
window.ScoreCardScreen = ScoreCardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/ScoreCardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/SemanticStudioScreen.jsx
try { (() => {
/* global React, Icon */
const {
  Tabs,
  Card,
  Input,
  Badge,
  Tag,
  DataTable,
  Button,
  Avatar
} = window.DS;
const TERMS = [{
  term: 'Customer Lifetime Value',
  domain: 'Finance',
  tags: ['Derived', 'PII-free'],
  owner: 'EA',
  status: 'Enriched'
}, {
  term: 'Active Subscription',
  domain: 'Commerce',
  tags: ['Core'],
  owner: 'BU',
  status: 'Enriched'
}, {
  term: 'Churn Risk Score',
  domain: 'Finance',
  tags: ['Derived', 'Model'],
  owner: 'AI',
  status: 'Draft'
}, {
  term: 'Employee Tenure',
  domain: 'People',
  tags: ['PII'],
  owner: 'DG',
  status: 'Needs review'
}, {
  term: 'Sensor Uptime',
  domain: 'Operations',
  tags: ['Streaming source'],
  owner: 'EA',
  status: 'Draft'
}];
const statusVariant = {
  'Enriched': 'success',
  'Draft': 'neutral',
  'Needs review': 'warning'
};
function SemanticStudioScreen() {
  const [tab, setTab] = React.useState('glossary');
  const [query, setQuery] = React.useState('');
  const rows = TERMS.filter(t => t.term.toLowerCase().includes(query.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: 'var(--gray-900)',
      marginBottom: 4
    }
  }, "Semantic Studio"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'var(--gray-500)'
    }
  }, "The data meaning layer \u2014 catalogue, business glossary and lineage with AI-assisted enrichment.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 15
    })
  }, "Enrich with AI")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-md)',
      background: 'var(--hex-electric-dim)',
      color: '#0A8A98',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "book-open",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: 'var(--gray-900)',
      lineHeight: 1
    }
  }, "142"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gray-500)'
    }
  }, "Glossary terms")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-md)',
      background: 'var(--hex-blue-light)',
      color: 'var(--hex-blue)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "database",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: 'var(--gray-900)',
      lineHeight: 1
    }
  }, "2,418"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gray-500)'
    }
  }, "Catalogued assets")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--r-md)',
      background: 'var(--hex-honey-dim)',
      color: 'var(--hex-honey)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "git-branch",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: 'var(--gray-900)',
      lineHeight: 1
    }
  }, "68%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gray-500)'
    }
  }, "Lineage coverage"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border-default)',
      padding: '8px 24px 0',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    tabs: [{
      id: 'glossary',
      label: 'Business glossary'
    }, {
      id: 'catalogue',
      label: 'Catalogue'
    }, {
      id: 'lineage',
      label: 'Lineage'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search terms\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 16
    })
  })), /*#__PURE__*/React.createElement(DataTable, {
    columns: [{
      key: 'term',
      header: 'Term',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 600,
          color: 'var(--gray-900)'
        }
      }, v)
    }, {
      key: 'domain',
      header: 'Domain'
    }, {
      key: 'tags',
      header: 'Classification',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          gap: 6,
          flexWrap: 'wrap'
        }
      }, v.map(t => /*#__PURE__*/React.createElement(Tag, {
        key: t
      }, t)))
    }, {
      key: 'owner',
      header: 'Owner',
      render: v => /*#__PURE__*/React.createElement(Avatar, {
        initials: v,
        tone: v === 'AI' ? 'success' : v === 'DG' ? 'electric' : 'blue',
        size: "sm"
      })
    }, {
      key: 'status',
      header: 'Status',
      render: v => /*#__PURE__*/React.createElement(Badge, {
        variant: statusVariant[v],
        dot: true
      }, v)
    }],
    rows: rows
  }));
}
window.SemanticStudioScreen = SemanticStudioScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/SemanticStudioScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Shell.jsx
try { (() => {
/* global React, Icon */
// Shell — platform chrome: fixed left sidebar + top bar. Children render
// in the content area. Uses the DS SidebarNav styling conventions inline so
// it can host Lucide icons in the nav chips.
const {
  Avatar
} = window.DS;
const NAV = [{
  id: 'score',
  label: 'Score Card',
  icon: 'layout-dashboard'
}, {
  id: 'assess',
  label: 'Assessment',
  icon: 'clipboard-list'
}, {
  id: 'studio',
  label: 'Semantic Studio',
  icon: 'layers'
}, {
  id: 'config',
  label: 'Configure',
  icon: 'settings'
}];
const TITLES = {
  score: 'Score Card',
  assess: 'Assessment',
  studio: 'Semantic Studio',
  config: 'Configure'
};
function Shell({
  active,
  onNavigate,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--surface-page)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 240,
      flexShrink: 0,
      background: '#fff',
      borderRight: '1px solid var(--border-default)',
      position: 'sticky',
      top: 0,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 20px 18px',
      borderBottom: '1px solid var(--border-default)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/brand-logo.svg",
    alt: "Brand",
    style: {
      display: 'block',
      width: 132,
      height: 'auto'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--gray-400)',
      fontWeight: 600,
      marginTop: 6,
      letterSpacing: '0.04em'
    }
  }, "AI-Ready Data Platform")), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: '0 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, NAV.map(n => {
    const on = n.id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => onNavigate(n.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 12px',
        borderRadius: 'var(--r-md)',
        fontSize: 14,
        fontWeight: on ? 700 : 500,
        fontFamily: 'var(--font-sans)',
        color: on ? 'var(--hex-blue)' : 'var(--gray-600)',
        background: on ? 'var(--hex-blue-light)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all var(--ease)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 24,
        height: 24,
        borderRadius: 'var(--r-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: on ? 'var(--hex-blue)' : 'var(--gray-100)',
        color: on ? '#fff' : 'var(--gray-500)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 15
    })), n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      padding: '12px 20px 0',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "CD",
    tone: "blue",
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--gray-800)'
    }
  }, "Priya Menon"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--gray-400)'
    }
  }, "Chief Data Officer")))), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 64,
      flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: 'var(--gray-400)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Meridian Corp"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gray-800)',
      fontWeight: 700
    }
  }, TITLES[active])), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      color: 'var(--gray-400)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 18
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 24,
      background: 'var(--border-default)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gray-500)'
    }
  }, "Q2 2026 cycle"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 32,
      maxWidth: 1280,
      width: '100%'
    }
  }, children)));
}
window.Shell = Shell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.MetricCard = __ds_scope.MetricCard;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.MaturityScale = __ds_scope.MaturityScale;

__ds_ns.ModuleCard = __ds_scope.ModuleCard;

__ds_ns.ScoreRing = __ds_scope.ScoreRing;

})();
