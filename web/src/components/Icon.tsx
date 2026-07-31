const PATHS: Record<string, string> = {
  "layout-dashboard":
    "M3 3h7v9H3V3zm11 0h7v5h-7V3zM3 14h7v7H3v-7zm11 4h7v3h-7v-3zm0-4h7v2h-7v-2z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  bookmark:
    "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  "flask-conical":
    "M10 2v7.31L5.2 19.1A2 2 0 0 0 6.9 22h10.2a2 2 0 0 0 1.7-2.9L14 9.31V2M8.5 2h7",
  layers:
    "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "bar-chart-3": "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
  "notebook-pen":
    "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4M2 6h4M2 10h4M2 14h4M2 18h4M21.4 6.6a2.1 2.1 0 0 0-3-3L12 10v3h3z",
  "book-open":
    "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  "sliders-horizontal":
    "M21 4H14M10 4H3M21 12H12M8 12H3M21 20H16M12 20H3M14 2v4M8 10v4M16 18v4",
  settings:
    "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  search: "M11 11a6 6 0 1 0-6-6 6 6 0 0 0 6 6zM21 21l-4.3-4.3",
  command: "M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3",
  "rows-3": "M4 6h16M4 12h16M4 18h16",
  "refresh-cw":
    "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
  "chevron-up": "M18 15l-6-6-6 6",
  "external-link":
    "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  x: "M18 6 6 18M6 6l12 12",
  "trending-up": "M22 7l-8.5 8.5-5-5L2 17M16 7h6v6",
  "trending-down": "M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6",
  database:
    "M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6",
  "search-x":
    "M11 11a6 6 0 1 0-6-6 6 6 0 0 0 6 6zM21 21l-4.3-4.3M13.5 8.5l-5 5M8.5 8.5l5 5",
  "candlestick-chart":
    "M9 5v4M9 15v4M15 3v2M15 15v6M5 9h4M15 9h4M5 15h4",
  pencil: "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
  "trash-2":
    "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6",
  sparkles:
    "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14zM5 14l.6 1.6L7 16.2l-1.4.6L5 18.4l-.6-1.6L3 16.2l1.4-.6L5 14z",
  pin: "M12 17v5M9 10.76V7a3 3 0 0 1 6 0v3.76l2.85 2.85A.5.5 0 0 1 17.5 15h-11a.5.5 0 0 1-.35-.85z",
  eraser:
    "M7 21h10M4.5 13.5l8-8a2.8 2.8 0 0 1 4 4l-8 8H4.5zM13 7l4 4",
  upload:
    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download:
    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  "upload-cloud":
    "M4 14.9A7 7 0 1 1 15.7 8h1.8a5 5 0 0 1 2.3 9.5M12 12v9M8 16l4-4 4 4",
  "calendar-days":
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  palette:
    "M12 2a10 10 0 1 0 0 20h.5a2.5 2.5 0 0 0 0-5H14a2 2 0 0 1 0-4h3a4 4 0 0 0 0-8h-5zM7.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM10 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM14.5 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  check: "M20 6 9 17l-5-5",
  "arrow-left": "M19 12H5M12 19l-7-7 7-7",
  "arrow-right": "M5 12h14M12 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  square: "M5 5h14v14H5z",
  "rotate-cw":
    "M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.6L21 8M21 3v5h-5",
  "alert-triangle":
    "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  "check-circle-2":
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4",
  "file-spreadsheet":
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h2M8 17h2M14 13h2M14 17h2",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  copy: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
};

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 18, className }: IconProps) {
  const d = PATHS[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="4" />}
    </svg>
  );
}
