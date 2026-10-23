import { Screen, paginationControls } from './screen';
import { pageWindow } from './screen-layout';
import { escapeHtml } from './presentation';
import { paintTitleScene } from './facility-art';
import {
  loadProfiles,
  saveProfile,
  createProfile,
  deleteProfile,
  setActiveProfileName,
  getActiveProfileName,
} from './save';
import type { SaveProfile } from './save';

export class LoginScreen {
  private screen: Screen;
  private profiles = loadProfiles();
  private expanded = false;
  private resolved = false;
  private profilePage = 0;
  constructor(canvas: HTMLCanvasElement, privateLogin: (profile: SaveProfile) => void) {
    this.screen = new Screen(canvas, 'title-screen', (e) => {
      if (e.key === 'Escape' && this.expanded) {
        e.preventDefault(); this.expanded = false; this.render();
      } else if ((e.key === 'PageDown' || e.key === 'PageUp') && this.expanded) {
        e.preventDefault();
        this.profilePage += e.key === 'PageDown' ? 1 : -1;
        this.render();
      } else if (e.key === 'Enter' && !this.expanded) {
        e.preventDefault();
        this.start(privateLogin);
      }
    });
    this.screen.root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'start') this.start(privateLogin);
      if (action === 'profiles') {
        this.expanded = !this.expanded;
        this.render();
      }
      if (action === 'profile-page') {
        this.profilePage += Number(button.dataset.direction);
        this.render();
        this.screen.root.querySelector<HTMLElement>('[data-action="profile"]')?.focus({ preventScroll: true });
      }
      if (action === 'profile') {
        const profile = this.profiles[Number(button.dataset.index)];
        if (profile) this.finish(profile, privateLogin);
      }
      if (action === 'delete') {
        const profile = this.profiles[Number(button.dataset.index)];
        if (profile && confirm(`删除「${profile.name}」的本机档案及进度？`)) {
          deleteProfile(profile.name);
          this.profiles = loadProfiles();
          this.render();
        }
      }
    });
    this.screen.root.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = this.screen.root.querySelector<HTMLInputElement>('#commander-name');
      const name = input?.value.trim();
      if (!name) return;
      const existing = this.profiles.find((p) => p.name === name);
      const profile = existing ?? createProfile(name);
      if (!existing) saveProfile(profile);
      this.finish(profile, privateLogin);
    });
    this.screen.onResize(() => this.render());
    this.render();
  }
  private start(onLogin: (profile: SaveProfile) => void): void {
    const profile =
      this.profiles.find((p) => p.name === getActiveProfileName()) ??
      this.profiles[0] ??
      createProfile('指挥官');
    if (!this.profiles.includes(profile)) saveProfile(profile);
    this.finish(profile, onLogin);
  }
  private finish(profile: SaveProfile, onLogin: (profile: SaveProfile) => void): void {
    if (this.resolved) return;
    this.resolved = true;
    setActiveProfileName(profile.name);
    this.screen.destroy();
    onLogin(profile);
  }
  render(): void {
    const page = pageWindow(this.profiles.length, 3, this.profilePage);
    this.profilePage = page.page;
    const profiles = this.profiles
      .slice(page.start, page.end)
      .map(
        (p, i) =>
          `<div class="profile-row"><button class="profile-choice" data-action="profile" data-index="${page.start+i}" data-focus-key="profile-${page.start+i}"><strong>${escapeHtml(p.name)}</strong><span>已完成 ${p.clearedLevels?.length ?? 0} 段航线 · 最佳 ${p.stats.highScore.toLocaleString()} 分</span></button><button class="icon-button" data-action="delete" data-index="${page.start+i}" aria-label="删除${escapeHtml(p.name)}档案">×</button></div>`,
      )
      .join('');
    const profileView = `<div class="profiles-view"><header><h1>选择航行档案</h1><p>进度只保存在当前浏览器。</p></header><div class="profile-list">${profiles || '<p class="subtle-note">还没有档案，可在下方建立。</p>'}</div>${paginationControls(page,'profile-page','档案')}<form class="profile-form"><label for="commander-name">新的指挥官</label><div><input id="commander-name" data-focus-key="commander-name" maxlength="24" placeholder="输入名称" required autocomplete="off"><button type="submit" class="quiet-button">建立档案 →</button></div></form><button class="text-button" data-action="profiles" data-focus-key="profiles-back">← 返回航行</button></div>`;
    const introduction = `<p class="eyebrow"><span></span> A NETWORK AMONG THE STARS</p>
      <h1>星域节点<span>连接群星，<br>守护彼此。</span></h1>
      <p class="title-description">从一颗核心开始，让能量沿航线流动。<br>在未知星域中侦察、布网，建立能够彼此回应的防线。</p>
      <div class="title-actions"><button class="primary-button large" data-action="start">${this.profiles.length ? '继续航行' : '开始航行'}<span>↗</span></button><button class="text-button" data-action="profiles">${this.expanded ? '收起档案' : '管理航行档案'} <span>＋</span></button></div>
      <div class="title-principles"><div><b>01</b><span>构筑网络</span><small>每一条连接都有意义</small></div><div><b>02</b><span>探索未知</span><small>让侦察成为行动的一部分</small></div><div><b>03</b><span>守护核心</span><small>在变化中重新组织防线</small></div></div>`;
    this.screen.render(`${this.screen.header('远征指挥系统 / 01')}
      <section class="title-layout"><div class="title-copy ${this.expanded ? 'profiles-copy' : ''}">${this.expanded ? profileView : introduction}</div>
      <div class="title-art" aria-hidden="true"><canvas class="title-scenario" width="720" height="650"></canvas><div class="title-art-caption"><span>FRONTIER OPERATIONS</span><strong>自由构筑 / 网络塔防</strong></div></div></section>
      <footer class="screen-footer"><span>一张网络，一片星域。</span><span>${this.expanded ? '选择档案 · PageUp / Down 翻页 · Esc 返回' : 'Enter 开始 · 进度自动保存在本机'}</span><span>独立策略游戏 / STARFIELD NODES</span></footer>`);
    paintTitleScene(this.screen.root.querySelector<HTMLCanvasElement>('.title-scenario')!);
  }
}
