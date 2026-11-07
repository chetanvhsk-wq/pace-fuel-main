import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, RotateCcw } from 'lucide-react';

interface MuscleMapProps {
  recovery: { [key: string]: number };
  onMuscleClick?: (muscle: string) => void;
  selectedMuscle?: string;
}

type BodySide = 'front' | 'back';

type PathShape = {
  d: string;
  mirror?: boolean;
};

type MuscleRegion = {
  id: string;
  label: string;
  side: BodySide;
  shapes: PathShape[];
};

const VIEWBOX_WIDTH = 240;

const BODY_SILHOUETTES: Record<
  BodySide,
  {
    torso: string;
    leftArm: string;
    rightArm: string;
    leftLeg: string;
    rightLeg: string;
  }
> = {
  front: {
    torso:
      'M120 95 C104 96 90 104 80 118 C69 133 64 154 65 177 C67 205 78 231 92 252 C101 265 107 281 110 299 L114 338 C116 373 113 408 108 438 L120 438 L132 438 C127 408 124 373 126 338 L130 299 C133 281 139 265 148 252 C162 231 173 205 175 177 C176 154 171 133 160 118 C150 104 136 96 120 95 Z',
    leftArm:
      'M81 120 C62 134 51 160 49 191 C47 219 51 247 58 273 C62 288 69 300 79 306 C84 286 84 263 80 240 C75 214 73 188 74 162 C74 145 77 131 81 120 Z',
    rightArm:
      'M159 120 C178 134 189 160 191 191 C193 219 189 247 182 273 C178 288 171 300 161 306 C156 286 156 263 160 240 C165 214 167 188 166 162 C166 145 163 131 159 120 Z',
    leftLeg:
      'M114 300 C103 329 97 365 95 402 C94 430 98 455 106 476 L118 476 C120 457 121 434 121 408 C121 367 119 331 114 300 Z',
    rightLeg:
      'M126 300 C137 329 143 365 145 402 C146 430 142 455 134 476 L122 476 C120 457 119 434 119 408 C119 367 121 331 126 300 Z',
  },
  back: {
    torso:
      'M120 93 C104 94 90 103 80 118 C70 132 66 152 68 175 C71 202 82 228 95 247 C103 258 108 274 111 292 L115 340 C117 374 114 409 109 438 L120 438 L131 438 C126 409 123 374 125 340 L129 292 C132 274 137 258 145 247 C158 228 169 202 172 175 C174 152 170 132 160 118 C150 103 136 94 120 93 Z',
    leftArm:
      'M82 119 C65 133 55 159 53 190 C51 217 55 244 61 267 C65 282 72 293 81 298 C85 279 85 258 82 236 C78 210 77 184 77 159 C77 143 79 130 82 119 Z',
    rightArm:
      'M158 119 C175 133 185 159 187 190 C189 217 185 244 179 267 C175 282 168 293 159 298 C155 279 155 258 158 236 C162 210 163 184 163 159 C163 143 161 130 158 119 Z',
    leftLeg:
      'M115 294 C103 324 96 360 94 398 C93 427 97 454 105 476 L117 476 C119 456 120 433 120 407 C120 367 118 330 115 294 Z',
    rightLeg:
      'M125 294 C137 324 144 360 146 398 C147 427 143 454 135 476 L123 476 C121 456 120 433 120 407 C120 367 122 330 125 294 Z',
  },
};

const MUSCLE_REGIONS: MuscleRegion[] = [
  {
    id: 'shoulders',
    label: 'Shoulders',
    side: 'front',
    shapes: [
      { d: 'M99 112 C83 114 72 124 66 138 C80 141 94 134 105 120 C106 116 104 113 99 112 Z' },
      { d: 'M99 112 C83 114 72 124 66 138 C80 141 94 134 105 120 C106 116 104 113 99 112 Z', mirror: true },
    ],
  },
  {
    id: 'chest',
    label: 'Chest',
    side: 'front',
    shapes: [
      { d: 'M108 132 C95 138 86 150 84 166 C94 175 107 179 118 176 C118 158 114 144 108 132 Z' },
      { d: 'M108 132 C95 138 86 150 84 166 C94 175 107 179 118 176 C118 158 114 144 108 132 Z', mirror: true },
    ],
  },
  {
    id: 'biceps',
    label: 'Biceps',
    side: 'front',
    shapes: [
      { d: 'M75 150 C64 163 61 182 64 204 C67 222 73 236 82 245 C88 235 89 220 87 201 C84 183 81 165 75 150 Z' },
      { d: 'M75 150 C64 163 61 182 64 204 C67 222 73 236 82 245 C88 235 89 220 87 201 C84 183 81 165 75 150 Z', mirror: true },
    ],
  },
  {
    id: 'forearms',
    label: 'Forearms',
    side: 'front',
    shapes: [
      { d: 'M73 248 C66 262 65 280 69 296 C73 310 80 320 88 325 C92 311 91 296 87 281 C84 267 79 255 73 248 Z' },
      { d: 'M73 248 C66 262 65 280 69 296 C73 310 80 320 88 325 C92 311 91 296 87 281 C84 267 79 255 73 248 Z', mirror: true },
    ],
  },
  {
    id: 'abs',
    label: 'Abs',
    side: 'front',
    shapes: [
      { d: 'M108 182 C100 198 96 219 96 242 C96 264 101 284 111 299 C114 301 117 302 120 302 C123 302 126 301 129 299 C139 284 144 264 144 242 C144 219 140 198 132 182 C128 186 124 188 120 188 C116 188 112 186 108 182 Z' },
    ],
  },
  {
    id: 'quads',
    label: 'Quads',
    side: 'front',
    shapes: [
      { d: 'M112 304 C100 324 94 353 93 384 C93 413 98 438 107 457 C115 448 119 431 121 408 C123 377 120 341 116 309 Z' },
      { d: 'M112 304 C100 324 94 353 93 384 C93 413 98 438 107 457 C115 448 119 431 121 408 C123 377 120 341 116 309 Z', mirror: true },
    ],
  },
  {
    id: 'calves',
    label: 'Calves',
    side: 'front',
    shapes: [
      { d: 'M108 394 C99 411 97 431 100 450 C102 464 107 475 114 482 C118 466 119 447 116 428 C114 414 112 402 108 394 Z' },
      { d: 'M108 394 C99 411 97 431 100 450 C102 464 107 475 114 482 C118 466 119 447 116 428 C114 414 112 402 108 394 Z', mirror: true },
    ],
  },
  {
    id: 'traps',
    label: 'Traps',
    side: 'back',
    shapes: [
      { d: 'M103 109 C109 120 114 126 120 128 C126 126 131 120 137 109 C131 102 126 99 120 99 C114 99 109 102 103 109 Z' },
    ],
  },
  {
    id: 'upper-back',
    label: 'Upper Back',
    side: 'back',
    shapes: [
      { d: 'M107 132 C93 139 85 153 83 171 C81 191 88 210 102 225 C112 214 117 198 117 178 C117 159 113 144 107 132 Z' },
      { d: 'M107 132 C93 139 85 153 83 171 C81 191 88 210 102 225 C112 214 117 198 117 178 C117 159 113 144 107 132 Z', mirror: true },
    ],
  },
  {
    id: 'triceps',
    label: 'Triceps',
    side: 'back',
    shapes: [
      { d: 'M76 146 C66 159 63 178 66 199 C69 216 75 230 83 239 C88 229 90 214 89 197 C87 180 83 162 76 146 Z' },
      { d: 'M76 146 C66 159 63 178 66 199 C69 216 75 230 83 239 C88 229 90 214 89 197 C87 180 83 162 76 146 Z', mirror: true },
    ],
  },
  {
    id: 'lower-back',
    label: 'Lower Back',
    side: 'back',
    shapes: [
      { d: 'M108 228 C101 244 98 262 98 281 C98 295 101 308 108 319 C113 310 117 300 120 289 C123 300 127 310 132 319 C139 308 142 295 142 281 C142 262 139 244 132 228 C128 232 124 234 120 234 C116 234 112 232 108 228 Z' },
    ],
  },
  {
    id: 'glutes',
    label: 'Glutes',
    side: 'back',
    shapes: [
      { d: 'M112 304 C100 311 92 325 92 342 C92 359 99 375 111 385 C117 373 120 358 120 340 C120 324 117 311 112 304 Z' },
      { d: 'M112 304 C100 311 92 325 92 342 C92 359 99 375 111 385 C117 373 120 358 120 340 C120 324 117 311 112 304 Z', mirror: true },
    ],
  },
  {
    id: 'hamstrings',
    label: 'Hamstrings',
    side: 'back',
    shapes: [
      { d: 'M113 356 C101 376 94 404 94 435 C94 456 99 474 107 488 C115 476 119 458 121 435 C123 408 120 381 116 360 Z' },
      { d: 'M113 356 C101 376 94 404 94 435 C94 456 99 474 107 488 C115 476 119 458 121 435 C123 408 120 381 116 360 Z', mirror: true },
    ],
  },
  {
    id: 'calves',
    label: 'Calves',
    side: 'back',
    shapes: [
      { d: 'M108 428 C100 446 98 466 101 484 C103 497 108 507 114 513 C119 496 120 477 117 458 C115 445 112 434 108 428 Z' },
      { d: 'M108 428 C100 446 98 466 101 484 C103 497 108 507 114 513 C119 496 120 477 117 458 C115 445 112 434 108 428 Z', mirror: true },
    ],
  },
];

function getRecoveryPalette(score: number, selected: boolean) {
  if (selected) {
    return {
      fill: 'rgba(8, 145, 178, 0.78)',
      stroke: '#0f766e',
      text: 'text-cyan-700',
      glow: 'drop-shadow(0 0 16px rgba(8, 145, 178, 0.28))',
    };
  }

  if (score > 80) {
    return {
      fill: 'rgba(34, 197, 94, 0.30)',
      stroke: 'rgba(22, 163, 74, 0.88)',
      text: 'text-green-600',
      glow: 'none',
    };
  }

  if (score > 50) {
    return {
      fill: 'rgba(245, 158, 11, 0.24)',
      stroke: 'rgba(217, 119, 6, 0.9)',
      text: 'text-orange-600',
      glow: 'none',
    };
  }

  return {
    fill: 'rgba(239, 68, 68, 0.24)',
    stroke: 'rgba(220, 38, 38, 0.92)',
    text: 'text-red-600',
    glow: 'none',
  };
}

function getRecoveryLabel(score: number) {
  if (score > 80) return 'Ready';
  if (score > 50) return 'Manage Load';
  return 'Fatigued';
}

function renderShape(shape: PathShape, fill: string, stroke: string, key: string, selected: boolean) {
  return (
    <motion.path
      key={key}
      d={shape.d}
      transform={shape.mirror ? `translate(${VIEWBOX_WIDTH} 0) scale(-1 1)` : undefined}
      fill={fill}
      stroke={stroke}
      strokeWidth={selected ? 2.2 : 1.75}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export default function MuscleMap({
  recovery,
  onMuscleClick,
  selectedMuscle,
}: MuscleMapProps) {
  const [view, setView] = useState<BodySide>('front');

  const selectedRegion = MUSCLE_REGIONS.find(
    (region) => region.id === selectedMuscle && region.side === view,
  );
  const selectedRecovery = selectedMuscle ? recovery[selectedMuscle] || 100 : null;

  const renderBody = (side: BodySide) => {
    const silhouette = BODY_SILHOUETTES[side];
    const visibleRegions = MUSCLE_REGIONS.filter((region) => region.side === side);

    return (
      <motion.div
        key={side}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -18, scale: 0.98 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="w-full"
      >
        <svg viewBox="0 0 240 520" className="mx-auto h-auto w-full max-w-[340px]">
          <defs>
            <linearGradient id={`silhouette-fill-${side}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f9fcf7" />
              <stop offset="100%" stopColor="#dce6d7" />
            </linearGradient>
            <linearGradient id={`silhouette-stroke-${side}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c8d6c1" />
              <stop offset="100%" stopColor="#9eb39d" />
            </linearGradient>
            <filter id={`soft-shadow-${side}`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="18" stdDeviation="12" floodColor="rgba(15, 23, 42, 0.14)" />
            </filter>
          </defs>

          <ellipse
            cx="120"
            cy="56"
            rx="28"
            ry="34"
            fill={`url(#silhouette-fill-${side})`}
            stroke={`url(#silhouette-stroke-${side})`}
            strokeWidth="2"
            filter={`url(#soft-shadow-${side})`}
          />

          <path
            d="M112 92 C115 99 118 103 120 106 C122 103 125 99 128 92"
            fill="none"
            stroke="#afbea9"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {[silhouette.leftArm, silhouette.rightArm, silhouette.leftLeg, silhouette.rightLeg, silhouette.torso].map((path, index) => (
            <path
              key={`${side}-silhouette-${index}`}
              d={path}
              fill={`url(#silhouette-fill-${side})`}
              stroke={`url(#silhouette-stroke-${side})`}
              strokeWidth="2"
              filter={`url(#soft-shadow-${side})`}
            />
          ))}

          <path
            d={side === 'front' ? 'M120 132 L120 474' : 'M120 126 L120 474'}
            fill="none"
            stroke="rgba(123, 138, 122, 0.5)"
            strokeWidth="1.25"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />

          {visibleRegions.map((region) => {
            const score = recovery[region.id] || 100;
            const isSelected = selectedMuscle === region.id;
            const palette = getRecoveryPalette(score, isSelected);

            return (
              <motion.g
                key={`${side}-${region.id}`}
                onClick={() => onMuscleClick?.(region.id)}
                className="cursor-pointer"
                style={{ filter: palette.glow, transformBox: 'fill-box', transformOrigin: 'center' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.985 }}
                animate={isSelected ? { opacity: [0.94, 1, 0.94] } : { opacity: 1 }}
                transition={isSelected ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              >
                {region.shapes.map((shape, index) =>
                  renderShape(shape, palette.fill, palette.stroke, `${region.id}-${index}`, isSelected),
                )}
              </motion.g>
            );
          })}
        </svg>
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-[2.75rem] border border-surface-container bg-[radial-gradient(circle_at_top,_rgba(13,99,27,0.12),_transparent_40%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(241,247,237,0.96))] p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(13,99,27,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(13,99,27,0.035)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="font-label text-[10px] uppercase tracking-[0.25em] text-outline font-bold">
            Recovery Atlas
          </span>
          <div>
            <p className="font-headline text-2xl font-black tracking-tight text-on-surface">
              {view === 'front' ? 'Anterior Anatomy' : 'Posterior Anatomy'}
            </p>
            <p className="text-sm text-outline font-body">
              Tap a muscle group to inspect recovery and choose a smarter training focus.
            </p>
          </div>
        </div>

        <button
          onClick={() => setView(view === 'front' ? 'back' : 'front')}
          className="inline-flex items-center gap-2 rounded-2xl border border-surface-container bg-white/80 px-4 py-3 text-outline transition-colors hover:text-primary"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="font-label text-[10px] uppercase tracking-widest font-bold">
            Flip
          </span>
        </button>
      </div>

      <div className="relative z-10 mt-6 flex items-center justify-center">
        <div className="rounded-[2.5rem] border border-white/70 bg-white/70 px-2 py-2 shadow-inner">
          <div className="flex gap-2 rounded-[1.4rem] bg-surface-container p-1">
            {(['front', 'back'] as BodySide[]).map((side) => (
              <button
                key={side}
                onClick={() => setView(side)}
                className={`rounded-[1rem] px-5 py-2.5 font-label text-[10px] font-bold uppercase tracking-widest transition-all ${
                  view === side
                    ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                    : 'text-outline hover:bg-white/70'
                }`}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-7">{renderBody(view)}</div>

      <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Ready', className: 'bg-green-500/15 text-green-700 border-green-500/20' },
              { label: 'Manage Load', className: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
              { label: 'Fatigued', className: 'bg-red-500/15 text-red-700 border-red-500/20' },
            ].map((item) => (
              <span
                key={item.label}
                className={`rounded-full border px-3 py-2 font-label text-[10px] font-bold uppercase tracking-widest ${item.className}`}
              >
                {item.label}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-outline" />
            <p className="text-sm text-outline">
              Balanced, mirrored regions keep the anatomy consistent front-to-back, so you can read recovery quickly without the body looking warped.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${selectedRegion?.id ?? 'overview'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-sm"
          >
            {selectedRegion && selectedRecovery !== null ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.25em] text-outline font-bold">
                      Selected Region
                    </p>
                    <h3 className="font-headline text-2xl font-black tracking-tight text-on-surface">
                      {selectedRegion.label}
                    </h3>
                  </div>
                  <div className={`rounded-2xl px-4 py-3 font-headline text-xl font-black ${getRecoveryPalette(selectedRecovery, true).text} bg-cyan-50`}>
                    {selectedRecovery}%
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-container">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedRecovery}%` }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      selectedRecovery > 80
                        ? 'bg-green-500'
                        : selectedRecovery > 50
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                    }`}
                  />
                </div>
                <p className="text-sm text-outline">
                  Status: <span className="font-semibold text-on-surface">{getRecoveryLabel(selectedRecovery)}</span>. Adjust your workout volume accordingly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-label text-[10px] uppercase tracking-[0.25em] text-outline font-bold">
                  Body Readiness
                </p>
                <h3 className="font-headline text-2xl font-black tracking-tight text-on-surface">
                  Tap any highlighted muscle group
                </h3>
                <p className="text-sm text-outline">
                  The selected region will show its recovery score here so you can decide whether to push, maintain, or back off.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
