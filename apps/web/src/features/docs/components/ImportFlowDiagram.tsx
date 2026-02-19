/**
 * VOC 数据导入模块 SVG 架构图。
 * 四层架构（前端 / API / 核心服务 / 数据层）+ CSS 流动动画。
 */

const LAYER_W = 820;
const LAYER_H = 120;
const LAYER_X = 40;
const LAYER_GAP = 60;

/** 层 Y 坐标 */
const ly = (i: number) => 30 + i * (LAYER_H + LAYER_GAP);

/** 层间箭头起点 Y */
const arrowY1 = (i: number) => ly(i) + LAYER_H;
/** 层间箭头终点 Y */
const arrowY2 = (i: number) => ly(i + 1);

/** 层内模块小矩形 */
function ModuleBox({
  x,
  y,
  w,
  label,
  color,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  color: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={28}
        rx={6}
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeOpacity={0.4}
      />
      <text
        x={x + w / 2}
        y={y + 18}
        textAnchor="middle"
        fill="white"
        fillOpacity={0.85}
        fontSize={11}
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

/** 层间带动画的双向箭头 */
function FlowArrow({
  cx,
  y1,
  y2,
  color,
  id,
}: {
  cx: number;
  y1: number;
  y2: number;
  color: string;
  id: string;
}) {
  const my = (y1 + y2) / 2;
  return (
    <g>
      {/* 静态线 */}
      <line
        x1={cx}
        y1={y1}
        x2={cx}
        y2={y2}
        stroke={color}
        strokeOpacity={0.2}
        strokeWidth={2}
      />
      {/* 下行流动粒子 */}
      <line
        x1={cx - 4}
        y1={y1}
        x2={cx - 4}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 14"
        className={`anim-flow-down-${id}`}
      />
      {/* 上行流动粒子 */}
      <line
        x1={cx + 4}
        y1={y2}
        x2={cx + 4}
        y2={y1}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 14"
        className={`anim-flow-up-${id}`}
      />
      {/* 箭头头部（下） */}
      <polygon
        points={`${cx},${y2} ${cx - 5},${y2 - 8} ${cx + 5},${y2 - 8}`}
        fill={color}
        fillOpacity={0.5}
      />
      {/* 箭头头部（上） */}
      <polygon
        points={`${cx},${y1} ${cx - 5},${y1 + 8} ${cx + 5},${y1 + 8}`}
        fill={color}
        fillOpacity={0.5}
      />
      {/* 标签 */}
      <text
        x={cx + 14}
        y={my + 4}
        fill={color}
        fillOpacity={0.6}
        fontSize={10}
        fontFamily="ui-monospace, monospace"
      >
        {id === "http" ? "HTTP" : id === "svc" ? "call" : "I/O"}
      </text>
    </g>
  );
}

export function ImportFlowDiagram() {
  const svgH = ly(3) + LAYER_H + 30;
  const svgW = LAYER_X * 2 + LAYER_W;

  const layerColors = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981"];
  const layerLabels = [
    "前端层  (React SPA)",
    "API 层  (FastAPI)",
    "核心服务层",
    "数据层",
  ];

  /* ---- 每层模块 ---- */
  const frontendModules = [
    "StepUpload",
    "StepPreview",
    "StepPrompt",
    "StepMapping",
    "StepImporting",
    "StepResult",
  ];
  const frontendExtra = ["use-import.ts", "voc-api.ts"];

  const apiModules = [
    "upload",
    "data-preview",
    "build-prompt",
    "generate-mapping",
    "confirm-mapping",
    "start-import",
  ];

  const coreModules = [
    "import_service",
    "schema_mapping_service",
    "prompt_builder",
    "file_parser",
    "import_background",
    "llm_client",
  ];

  const dataModules = [
    "PostgreSQL (voc)",
    "ingestion_batches",
    "voices",
    "schema_mappings",
    "LLM Service",
    "SlotRouter",
  ];

  const moduleColor = (li: number) => layerColors[li]!;

  /** 为一行模块计算 X 坐标 */
  const moduleLayout = (items: string[], row: number) => {
    const gapX = 8;
    const baseY = row === 0 ? 34 : 70;
    const ws = items.map((t) => Math.max(t.length * 7.5 + 16, 60));
    const totalW = ws.reduce((a, b) => a + b, 0) + gapX * (items.length - 1);
    let sx = (LAYER_W - totalW) / 2;
    const result: { x: number; w: number; label: string; y: number }[] = [];
    for (let i = 0; i < items.length; i++) {
      const w = ws[i]!;
      result.push({ x: sx, w, label: items[i]!, y: baseY });
      sx += w + gapX;
    }
    return result;
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ minWidth: 700 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          @keyframes flowDown {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: -40; }
          }
          @keyframes flowUp {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: 40; }
          }
          .anim-flow-down-http,
          .anim-flow-down-svc,
          .anim-flow-down-io {
            animation: flowDown 1.2s linear infinite;
          }
          .anim-flow-up-http,
          .anim-flow-up-svc,
          .anim-flow-up-io {
            animation: flowUp 1.2s linear infinite;
          }
          .anim-flow-down-svc { animation-duration: 1.6s; }
          .anim-flow-up-svc   { animation-duration: 1.6s; }
          .anim-flow-down-io  { animation-duration: 2s; }
          .anim-flow-up-io    { animation-duration: 2s; }
        `}</style>

        <defs>
          {layerColors.map((c, i) => (
            <linearGradient
              key={i}
              id={`lg${i}`}
              x1="0"
              y1="0"
              x2={LAYER_W}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={c} stopOpacity={0.08} />
              <stop offset="50%" stopColor={c} stopOpacity={0.14} />
              <stop offset="100%" stopColor={c} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>

        {/* 四层矩形 */}
        {layerLabels.map((label, i) => (
          <g key={i} transform={`translate(${LAYER_X}, ${ly(i)})`}>
            <rect
              width={LAYER_W}
              height={LAYER_H}
              rx={12}
              fill={`url(#lg${i})`}
              stroke={layerColors[i]}
              strokeOpacity={0.3}
              strokeWidth={1.5}
            />
            <text
              x={16}
              y={20}
              fill={layerColors[i]}
              fillOpacity={0.8}
              fontSize={12}
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              {label}
            </text>

            {/* 模块 */}
            {i === 0 && (
              <>
                {moduleLayout(frontendModules, 0).map((m) => (
                  <ModuleBox
                    key={m.label}
                    x={m.x}
                    y={m.y}
                    w={m.w}
                    label={m.label}
                    color={moduleColor(0)}
                  />
                ))}
                {moduleLayout(frontendExtra, 1).map((m) => (
                  <ModuleBox
                    key={m.label}
                    x={m.x}
                    y={m.y}
                    w={m.w}
                    label={m.label}
                    color={moduleColor(0)}
                  />
                ))}
              </>
            )}
            {i === 1 &&
              moduleLayout(apiModules, 0).map((m) => (
                <ModuleBox
                  key={m.label}
                  x={m.x}
                  y={m.y + 18}
                  w={m.w}
                  label={m.label}
                  color={moduleColor(1)}
                />
              ))}
            {i === 2 &&
              moduleLayout(coreModules, 0).map((m) => (
                <ModuleBox
                  key={m.label}
                  x={m.x}
                  y={m.y + 18}
                  w={m.w}
                  label={m.label}
                  color={moduleColor(2)}
                />
              ))}
            {i === 3 &&
              moduleLayout(dataModules, 0).map((m) => (
                <ModuleBox
                  key={m.label}
                  x={m.x}
                  y={m.y + 18}
                  w={m.w}
                  label={m.label}
                  color={moduleColor(3)}
                />
              ))}
          </g>
        ))}

        {/* 层间箭头 */}
        <FlowArrow
          cx={LAYER_X + LAYER_W / 2 - 80}
          y1={arrowY1(0)}
          y2={arrowY2(1)}
          color="#6366f1"
          id="http"
        />
        <FlowArrow
          cx={LAYER_X + LAYER_W / 2}
          y1={arrowY1(1)}
          y2={arrowY2(2)}
          color="#8b5cf6"
          id="svc"
        />
        <FlowArrow
          cx={LAYER_X + LAYER_W / 2 + 80}
          y1={arrowY1(2)}
          y2={arrowY2(3)}
          color="#10b981"
          id="io"
        />
      </svg>
    </div>
  );
}
