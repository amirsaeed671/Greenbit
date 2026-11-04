import { motion, useReducedMotion } from 'framer-motion';
import type { PlantStage } from '../core/plant';
import { plantById, type PlantSpecies } from '../data/plants';

interface Props {
  species: string;
  stage: PlantStage;
  wilting?: boolean;
  size?: number;
  title?: string;
}

function Flower({ s, x, y, r }: { s: PlantSpecies; x: number; y: number; r: number }) {
  switch (s.shape) {
    case 'tulip':
      return (
        <g>
          <path d={`M${x - r} ${y - r * 0.2} Q${x - r} ${y + r} ${x} ${y + r} Q${x + r} ${y + r} ${x + r} ${y - r * 0.2} L${x + r * 0.5} ${y + r * 0.2} L${x} ${y - r} L${x - r * 0.5} ${y + r * 0.2} Z`} fill={s.flower} />
        </g>
      );
    case 'spike':
      return (
        <g fill={s.flower}>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={x + (i % 2 ? r * 0.35 : -r * 0.35)} cy={y + r - i * r * 0.55} rx={r * 0.38} ry={r * 0.3} />
          ))}
        </g>
      );
    case 'berry':
      return (
        <g fill={s.flower}>
          <circle cx={x - r * 0.5} cy={y} r={r * 0.45} />
          <circle cx={x + r * 0.5} cy={y + r * 0.1} r={r * 0.45} />
          <circle cx={x} cy={y - r * 0.55} r={r * 0.45} />
        </g>
      );
    case 'fern':
      return null;
    default: {
      const petals = s.shape === 'sun' ? 12 : 8;
      return (
        <g>
          {Array.from({ length: petals }, (_, i) => (
            <ellipse key={i} cx={x} cy={y - r * 0.62} rx={r * 0.28} ry={r * 0.55} fill={s.flower} stroke={s.shape === 'daisy' ? '#00000014' : 'none'} transform={`rotate(${(360 / petals) * i} ${x} ${y})`} />
          ))}
          <circle cx={x} cy={y} r={r * (s.shape === 'sun' ? 0.5 : 0.36)} fill={s.center} />
        </g>
      );
    }
  }
}

function Leaf({ x, y, len, angle, color }: { x: number; y: number; len: number; angle: number; color: string }) {
  return (
    <path
      d={`M0 0 C ${len * 0.3} ${-len * 0.35} ${len * 0.8} ${-len * 0.35} ${len} 0 C ${len * 0.8} ${len * 0.3} ${len * 0.3} ${len * 0.3} 0 0 Z`}
      fill={color}
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

export function Plant({ species, stage, wilting = false, size = 76, title }: Props) {
  const s = plantById(species);
  const reduce = useReducedMotion();
  const stemTop = { seed: 72, sprout: 58, bud: 40, bloom: 30 }[stage];
  const leafColor = wilting ? '#9AA77F' : s.leaf;

  let body: JSX.Element;
  if (stage === 'seed') {
    body = (
      <g>
        <ellipse cx="50" cy="73" rx="7" ry="5" fill="#8B6B4E" />
        <path d="M50 70 q2 -6 6 -7" stroke={leafColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    );
  } else if (s.shape === 'cactus') {
    const h = { sprout: 14, bud: 26, bloom: 34 }[stage];
    body = (
      <g>
        <rect x="42" y={76 - h} width="16" height={h + 2} rx="8" fill={leafColor} />
        {stage !== 'sprout' && <path d={`M42 ${70 - h / 3} h-6 a4 4 0 0 1 -4 -4 v-8`} stroke={leafColor} strokeWidth="7" fill="none" strokeLinecap="round" />}
        {stage === 'bloom' && <path d={`M58 ${66 - h / 3} h6 a4 4 0 0 0 4 -4 v-6`} stroke={leafColor} strokeWidth="7" fill="none" strokeLinecap="round" />}
        {stage === 'bud' && <circle cx="50" cy={76 - h} r="4" fill={s.flower} />}
        {stage === 'bloom' && <Flower s={{ ...s, shape: 'daisy' }} x={50} y={76 - h} r={7} />}
      </g>
    );
  } else {
    const leaves =
      stage === 'sprout'
        ? [{ y: 62, a: -30, l: 12 }, { y: 62, a: -150, l: 12 }]
        : s.shape === 'fern'
          ? Array.from({ length: stage === 'bloom' ? 8 : 6 }, (_, i) => ({ y: 70 - i * 5.5, a: i % 2 ? -25 : -155, l: 18 - i * 1.4 }))
          : [{ y: 64, a: -25, l: 16 }, { y: 58, a: -160, l: 15 }, { y: 50, a: -20, l: 13 }, { y: 46, a: -150, l: 12 }];
    body = (
      <g>
        <path d={`M50 76 C 50 ${(76 + stemTop) / 2} 51 ${stemTop + 8} 50 ${stemTop}`} stroke={leafColor} strokeWidth="3" fill="none" strokeLinecap="round" />
        {leaves.map((l, i) => (
          <Leaf key={i} x={50} y={l.y} len={l.l} angle={l.a} color={leafColor} />
        ))}
        {stage === 'bud' && s.shape !== 'fern' && <ellipse cx="50" cy={stemTop - 2} rx="5" ry="7" fill={wilting ? '#C9B8A6' : s.flower} />}
        {stage === 'bloom' && s.shape !== 'fern' && <Flower s={wilting ? { ...s, flower: '#D8CBB8' } : s} x={50} y={stemTop - 4} r={11} />}
        {stage === 'bloom' && s.shape === 'fern' && <path d={`M50 ${stemTop} q6 -4 3 -10`} stroke={leafColor} strokeWidth="3" fill="none" strokeLinecap="round" />}
      </g>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? `${s.name}, ${stage}${wilting ? ', wilting' : ''}`}>
      <motion.g
        style={{ originX: '50px', originY: '76px' }}
        animate={reduce ? undefined : wilting ? { rotate: 8 } : { rotate: [0, 1.5, 0, -1.5, 0] }}
        transition={wilting ? { duration: 0.6 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {body}
      </motion.g>
      <path d="M30 76 h40 l-5 18 h-30 z" fill="#C7794B" />
      <rect x="27" y="72" width="46" height="7" rx="3" fill="#D98C5C" />
      <ellipse cx="50" cy="74" rx="19" ry="2.5" fill="#6E513A" />
    </svg>
  );
}
