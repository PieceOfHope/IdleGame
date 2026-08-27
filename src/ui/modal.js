import { formatNumber } from '../systems/resourceSystem.js';
import { formatDuration } from '../core/timeEngine.js';

export function closeModal(rootEl) {
  rootEl.innerHTML = '';
}

function renderModal(rootEl, { title, contentNode, actions }) {
  rootEl.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';

  const heading = document.createElement('h2');
  heading.textContent = title;
  box.append(heading, contentNode);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    if (action.primary) btn.className = 'btn-primary';
    btn.addEventListener('click', () => {
      action.onClick?.();
      if (!action.keepOpen) closeModal(rootEl);
    });
    actionsRow.appendChild(btn);
  }
  box.appendChild(actionsRow);

  overlay.appendChild(box);
  rootEl.appendChild(overlay);
}

export function showOfflineRewardModal(rootEl, { effectiveTimeSeconds, earnedByResource, resourceConfig }) {
  const content = document.createElement('div');

  const timeP = document.createElement('p');
  timeP.textContent = `오프라인 시간: ${formatDuration(effectiveTimeSeconds)}`;
  content.appendChild(timeP);

  const list = document.createElement('ul');
  list.className = 'reward-list';
  for (const [resourceId, amount] of Object.entries(earnedByResource)) {
    if (amount <= 0) continue;
    const li = document.createElement('li');
    li.textContent = `${resourceConfig[resourceId]?.name ?? resourceId} +${formatNumber(amount)}`;
    list.appendChild(li);
  }
  content.appendChild(list);

  renderModal(rootEl, {
    title: '어서오세요!',
    contentNode: content,
    actions: [{ label: '확인', primary: true }],
  });
}

export function showOfflineKillModal(rootEl, { effectiveTimeSeconds, totalKills, totalGold }) {
  const content = document.createElement('div');

  const timeP = document.createElement('p');
  timeP.textContent = `오프라인 시간: ${formatDuration(effectiveTimeSeconds)}`;
  content.appendChild(timeP);

  const list = document.createElement('ul');
  list.className = 'reward-list';
  const killLi = document.createElement('li');
  killLi.textContent = `몬스터 처치 ${formatNumber(totalKills)}마리`;
  list.appendChild(killLi);
  const goldLi = document.createElement('li');
  goldLi.textContent = `골드 +${formatNumber(totalGold)}`;
  list.appendChild(goldLi);
  content.appendChild(list);

  renderModal(rootEl, {
    title: '어서오세요!',
    contentNode: content,
    actions: [{ label: '확인', primary: true }],
  });
}

export function showExportModal(rootEl, jsonString) {
  const content = document.createElement('div');

  const textarea = document.createElement('textarea');
  textarea.className = 'save-textarea';
  textarea.readOnly = true;
  textarea.value = jsonString;
  content.appendChild(textarea);

  const hint = document.createElement('p');
  hint.className = 'modal-hint';
  hint.textContent = '아래 텍스트를 복사해서 안전한 곳에 보관하세요.';
  content.appendChild(hint);

  renderModal(rootEl, {
    title: '세이브 내보내기',
    contentNode: content,
    actions: [
      {
        label: '복사',
        keepOpen: true,
        onClick: () => {
          textarea.select();
          navigator.clipboard?.writeText(jsonString).catch(() => {});
        },
      },
      { label: '닫기', primary: true },
    ],
  });
}

export function showImportModal(rootEl, { onConfirm }) {
  const content = document.createElement('div');

  const textarea = document.createElement('textarea');
  textarea.className = 'save-textarea';
  textarea.placeholder = '내보낸 세이브 데이터(JSON)를 붙여넣으세요.';
  content.appendChild(textarea);

  renderModal(rootEl, {
    title: '세이브 가져오기',
    contentNode: content,
    actions: [
      { label: '취소' },
      { label: '가져오기', primary: true, onClick: () => onConfirm(textarea.value) },
    ],
  });
}

export function showResetConfirmModal(rootEl, { onConfirm }) {
  const content = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = '정말로 모든 진행 상황을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.';
  content.appendChild(p);

  renderModal(rootEl, {
    title: '초기화 확인',
    contentNode: content,
    actions: [
      { label: '취소' },
      { label: '초기화', primary: true, onClick: onConfirm },
    ],
  });
}
