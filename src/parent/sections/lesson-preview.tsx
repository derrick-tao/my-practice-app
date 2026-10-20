// Parent area section: preview a published lesson (every item's target, pinyin and clue, with its audio)
// to check the voice and the readings before the child practices. #/parent/lesson-preview shows the lessons;
// #/parent/lesson-preview/<lessonId> is one lesson's preview.
import { useMemo } from 'preact/hooks';
import { fetchLesson } from '../../content/client.ts';
import { listEntries, type ItemData, type LessonData, type Rendition } from '../../content/types.ts';
import { usePublishedLessons } from '../../content/use-lessons.ts';
import { useAudioPlayer, type AudioPlayer } from '../../practice/audio.ts';
import { countLabel, listCountsLabel, PRACTICE_TYPES, type PracticeType } from '../../practice/practice-types.tsx';
import { parentHref } from '../../router.ts';
import { useLoad } from '../../use-async.ts';
import '../lesson-preview.css';
import type { ParentSection } from '../sections.ts';

const SCRIPT_LABEL = { simplified: 'Simplified', traditional: 'Traditional' } as const;

const LOAD_FAILED = "Couldn't load the lessons. Check the internet and try again.";

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

function PreviewSection({ player, type, items }: { player: AudioPlayer; type: PracticeType; items: ItemData[] }) {
  return (
    <section class="preview-section" data-testid="preview-section">
      <h3 class="preview-section__title">
        <span aria-hidden="true">{type.icon} </span>
        {type.label}
      </h3>
      <ol class="preview-items">
        {items.map((item) => (
          <PreviewItem key={item.target} player={player} item={item} />
        ))}
      </ol>
    </section>
  );
}

function Preview({ lesson }: { lesson: LessonData }) {
  const player = useAudioPlayer();
  const lists = listEntries(lesson.lists);
  return (
    <>
      <div class="preview-header" data-testid="preview-header">
        <h2 class="preview-header__title">{lesson.title}</h2>
        <div class="preview-header__facts">
          <span>{SCRIPT_LABEL[lesson.script]}</span>
          {lesson.testDates && (
            <span>
              <span aria-hidden="true">📅 </span>Test: {lesson.testDates}
            </span>
          )}
          {lists.map(([id, items]) => (
            <span key={id}>{countLabel(PRACTICE_TYPES[id], items.length)}</span>
          ))}
        </div>
      </div>
      {lists.map(([id, items]) => (
        <PreviewSection key={id} player={player} type={PRACTICE_TYPES[id]} items={items} />
      ))}
    </>
  );
}

function LessonPreview({ lessonId }: { lessonId: string }) {
  const published = usePublishedLessons();
  const known = published.status === 'ready' && published.value.some((p) => p.lesson.id === lessonId);
  const lesson = useLoad(
    () => (known ? fetchLesson(lessonId) : Promise.reject(new Error('unknown lesson'))),
    [lessonId, known],
  );

  if (published.status === 'loading') return <p class="notice">Loading…</p>;
  if (published.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  if (!known) return <p class="notice">We couldn't find this lesson.</p>;
  if (lesson.status === 'loading') return <p class="notice">Loading…</p>;
  if (lesson.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return <Preview lesson={lesson.value} />;
}

function Lessons() {
  const lessons = usePublishedLessons();
  if (lessons.status === 'loading') return <p class="notice">Loading…</p>;
  if (lessons.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return (
    <ul class="preview-lessons">
      {lessons.value.map(({ lesson }) => (
        <li key={lesson.id}>
          <a class="parent__entry" href={parentHref('lesson-preview', lesson.id)}>
            {lesson.title}
            <span> · {listCountsLabel(lesson)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function LessonPreviewSection({ path }: { path: string[] }) {
  const [lessonId] = path;
  return lessonId === undefined ? <Lessons /> : <LessonPreview lessonId={lessonId} />;
}

export const section: ParentSection = {
  id: 'lesson-preview',
  title: 'Lesson preview',
  icon: '🔊',
  order: 50,
  Component: LessonPreviewSection,
};
