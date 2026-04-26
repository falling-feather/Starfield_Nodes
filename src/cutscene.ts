// ===== 过场动画系统 =====
import { COLORS } from './ui-tokens';

/** 每关的剧情文本 (关卡ID → 文本行数组) */
const LEVEL_STORIES: Record<number, { title: string; lines: string[] }> = {
  1: {
    title: '第一章 · 初始星域',
    lines: [
      '星历 2847 年，人类殖民舰队在银河边缘发现了一片未知星域。',
      '这里的恒星散发着异常的能量脉冲，似乎蕴含着无穷的可能。',
      '作为前哨站指挥官，你的任务是建立第一座能量核心基地。',
      '连接附近的节点，建立防御网络，抵御来袭的虫群。',
    ],
  },
  2: {
    title: '第二章 · 边境前哨',
    lines: [
      '初始星域的成功引起了总部的关注。',
      '一片更广阔的区域被标记为下一个扩张目标。',
      '但侦察报告显示，这里的虫群活动更加频繁。',
      '在陌生的星域中建立前哨，守住阵地。',
    ],
  },
  3: {
    title: '第三章 · 迷雾深处',
    lines: [
      '前方传来警报——一片浓密的星云遮蔽了传感器。',
      '在迷雾中，你需要部署信标来探索未知区域。',
      '情报显示，一只巨型虫族母体正潜伏在星云深处。',
      '找到它，消灭它。',
    ],
  },
  4: {
    title: '第四章 · 闪电突袭',
    lines: [
      '紧急任务！虫群发起了突然袭击。',
      '你只有三分钟的时间部署防线。',
      '总部正在调配增援舰队，但在那之前——',
      '一切只能靠你自己。',
    ],
  },
  5: {
    title: '第五章 · 多核心战役',
    lines: [
      '殖民议会决定在这片星域建立永久基地。',
      '多个核心需要同时运转，扩大领土的控制范围。',
      '虫群似乎也感受到了威胁，攻势愈发猛烈。',
      '建立你的星际帝国，抵御一切入侵者。',
    ],
  },
  6: {
    title: '第六章 · 虫巢终焉',
    lines: [
      '深空探测器定位到了虫族的巢穴核心。',
      '这是一场不容失败的战斗——消灭虫巢，终结地表威胁。',
      '但当母体陨落的那一刻，你听到了来自更深处的回响……',
      '故事，似乎才刚刚开始。',
    ],
  },
  7: {
    title: '第七章 · 裂隙风暴',
    lines: [
      '虫巢崩塌后，星域中浮现出无数细小的时空裂隙。',
      '它们像潮汐一样涌动，每一波都带来更陌生的造物。',
      '总部的命令是：稳住阵地，撑过整整三十波冲击。',
      '在风暴的中心，证明人类文明的韧性。',
    ],
  },
  8: {
    title: '终章 · 终局奇点',
    lines: [
      '裂隙的尽头，是一片寂静无光的奇点。',
      '所有信号在那里消散——除了一个缓慢跳动的心音。',
      '那是召唤虫群的源头，也是这场战争最后的答案。',
      '点亮你的核心，向奇点发起最后的冲锋。',
    ],
  },
};

export class CutsceneScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private story: { title: string; lines: string[] };
  private onDone: () => void;
  private animFrame = 0;
  private startTime = 0;
  private charIndex = 0;       // 当前显示到第几个字符
  private totalChars = 0;      // 所有行的总字符数
  private finished = false;    // 打字完成
  private stars: { x: number; y: number; s: number; b: number }[] = [];

  private keyHandler: (e: KeyboardEvent) => void;
  private clickHandler: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, levelId: number, onDone: () => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onDone = onDone;
    this.story = LEVEL_STORIES[levelId] ?? { title: '未知区域', lines: ['前方未知。保持警惕。'] };
    this.totalChars = this.story.lines.reduce((sum, l) => sum + l.length, 0);
    this.startTime = performance.now();

    // 生成背景星星
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 0.5 + Math.random() * 1.5,
        b: 0.3 + Math.random() * 0.7,
      });
    }

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        if (this.finished) {
          this.destroy();
        } else {
          // 跳过打字动画 — 直接显示全部
          this.charIndex = this.totalChars;
          this.finished = true;
        }
      }
    };
    this.clickHandler = () => {
      if (this.finished) {
        this.destroy();
      } else {
        this.charIndex = this.totalChars;
        this.finished = true;
      }
    };

    window.addEventListener('keydown', this.keyHandler);
    this.canvas.addEventListener('click', this.clickHandler);
    this.loop();
  }

  private destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.canvas.removeEventListener('click', this.clickHandler);
    cancelAnimationFrame(this.animFrame);
    this.onDone();
  }

  private loop = (): void => {
    this.render();
    this.animFrame = requestAnimationFrame(this.loop);
  };

  private render(): void {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const elapsed = (performance.now() - this.startTime) / 1000;

    // 黑色背景
    ctx.fillStyle = COLORS.bg.pure;
    ctx.fillRect(0, 0, w, h);

    // 星空
    for (const s of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 2 + s.x * 0.01);
      ctx.fillStyle = `rgba(200,220,255,${s.b * twinkle})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // 打字机速度
    if (!this.finished) {
      this.charIndex = Math.min(this.totalChars, Math.floor(elapsed * 18));
      if (this.charIndex >= this.totalChars) this.finished = true;
    }

    const cx = w / 2;
    const baseY = h * 0.25;

    // 标题
    const titleAlpha = Math.min(1, elapsed / 1.5);
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    ctx.fillStyle = '#66ccff';
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.story.title, cx, baseY);
    ctx.restore();

    // 剧情文本（打字机效果）
    ctx.fillStyle = '#ccddee';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';

    let charsLeft = this.charIndex;
    let lineY = baseY + 60;
    for (const line of this.story.lines) {
      if (charsLeft <= 0) break;
      const show = line.substring(0, charsLeft);
      ctx.fillText(show, cx, lineY);
      charsLeft -= line.length;
      lineY += 32;
    }

    // 提示
    if (this.finished) {
      const blink = Math.sin(elapsed * 3) > 0;
      if (blink) {
        ctx.fillStyle = COLORS.text.muted;
        ctx.font = '13px monospace';
        ctx.fillText('点击 或 按 Enter 继续', cx, h * 0.8);
      }
    }
  }
}
