// Parent area section: preview a published list (every item's target, pinyin and clue, with its audio)
// to check the voice and the readings before the child practices. #/parent/list-preview shows the lists;
// #/parent/list-preview/<listId> is one list's preview.
import { useMemo } from 'preact/hooks';
import { fetchList } from '../../content/client.ts';
import type { ItemData, ListData, Rendition } from '../../content/types.ts';
import { usePublishedLists } from '../../content/use-lists.ts';
import { createAudioPlayer, type AudioPlayer } from '../../practice/audio.ts';
import { parentHref } from '../../router.ts';
import { useLoad } from '../../use-async.ts';
import '../list-preview.css';
import type { ParentSection } from '../sections.ts';

const SCRIPT_LABEL = { simplified: 'Simplified', traditional: 'Traditional' } as const;

const characters = (count: number): string => `${count} ${count === 1 ? 'character' : 'characters'}`;

const LOAD_FAILED = "Couldn't load the lists. Check the internet and try again.";

function PlayButton({ player, item, rendition }: { player: AudioPlayer; item: ItemData; rendition: Rendition }) {
  const normal = rendition === 'normal';
  return (
    <button
      type="button"
      class="preview-item__play"
      aria-label={`${normal ? 'Normal' : 'Slow'} ${item.target}`}
      onClick={() => void player.play(item.audio[rendition])}
    >
      <span aria-hidden="true">{normal ? '▶️ Normal' : '🐢 Slow'}</span>
    </button>
  );
}

function PreviewItem({ player, item }: { player: AudioPlayer; item: ItemData }) {
  return (
    <li class="preview-item" data-testid="preview-item">
      <span class="preview-item__target" lang="zh-Hans">
        {item.target}
      </span>
      <span class="preview-item__text">
        <span class="preview-item__pinyin">{item.pinyin}</span>
        {item.clue && <span class="preview-item__clue">{item.clue}</span>}
      </span>
      <span class="preview-item__buttons">
        <PlayButton player={player} item={item} rendition="normal" />
        <PlayButton player={player} item={item} rendition="slow" />
      </span>
    </li>
  );
}

function Preview({ list }: { list: ListData }) {
  const player = useMemo(createAudioPlayer, []);
  return (
    <>
      <div class="preview-header" data-testid="preview-header">
        <h2 class="preview-header__title">{list.title}</h2>
        <div class="preview-header__facts">
          <span>{SCRIPT_LABEL[list.script]}</span>
          {list.testDates && (
            <span>
              <span aria-hidden="true">📅 </span>Test: {list.testDates}
            </span>
          )}
          <span>{characters(list.items.length)}</span>
        </div>
      </div>
      <ol class="preview-items">
        {list.items.map((item) => (
          <PreviewItem key={item.target} player={player} item={item} />
        ))}
      </ol>
    </>
  );
}

function ListPreview({ listId }: { listId: string }) {
  const published = usePublishedLists();
  const known = published.status === 'ready' && published.value.some((p) => p.list.id === listId);
  const list = useLoad(() => (known ? fetchList(listId) : Promise.reject(new Error('unknown list'))), [listId, known]);

  if (published.status === 'loading') return <p class="notice">Loading…</p>;
  if (published.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  if (!known) return <p class="notice">We couldn't find this list.</p>;
  if (list.status === 'loading') return <p class="notice">Loading…</p>;
  if (list.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return <Preview list={list.value} />;
}

function Lists() {
  const lists = usePublishedLists();
  if (lists.status === 'loading') return <p class="notice">Loading…</p>;
  if (lists.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return (
    <ul class="preview-lists">
      {lists.value.map(({ list }) => (
        <li key={list.id}>
          <a class="parent__entry" href={parentHref('list-preview', list.id)}>
            {list.title}
            <span> · {characters(list.itemCount)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ListPreviewSection({ path }: { path: string[] }) {
  const [listId] = path;
  return listId === undefined ? <Lists /> : <ListPreview listId={listId} />;
}

export const section: ParentSection = {
  id: 'list-preview',
  title: 'List preview',
  icon: '🔊',
  order: 50,
  Component: ListPreviewSection,
};
