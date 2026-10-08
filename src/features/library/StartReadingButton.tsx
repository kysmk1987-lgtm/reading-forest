import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, showToast } from '@/components/ui';
import { todayISO } from '@/lib/date';
import { useLibraryStore } from '@/stores/libraryStore';
import { useTimerStore } from '@/stores/timerStore';
import type { Book, LibraryEntry } from '@/types';

import { defaultProgressUnit } from './pages';

/**
 * "이 책 읽기 시작" on the book page: opens the 함께 읽기 timer with this book chosen and 시작 highlighted.
 * A wishlist / stopped book becomes 읽는 중; a book not in the library is added as 읽는 중 first.
 */
export function StartReadingButton({ book, entry, primary }: { book: Book; entry?: LibraryEntry; primary?: boolean }) {
  const { t } = useTranslation();

  const start = () => {
    const library = useLibraryStore.getState();
    const today = todayISO();
    let target = entry;
    if (!target) {
      target = library.addEntry({ book, status: 'reading', startDate: today, progressUnit: defaultProgressUnit(book.pageCount) });
      showToast(t('book.startReadingAdded'));
    } else if (target.status === 'want' || target.status === 'stopped') {
      library.updateEntry(target.id, {
        status: 'reading',
        startDate: target.status === 'want' ? today : (target.startDate ?? today),
        endDate: undefined,
        progressUnit: target.progressUnit ?? defaultProgressUnit(target.book.pageCount),
      });
      showToast(t('book.startReadingSwitched'));
    }
    const timer = useTimerStore.getState();
    const busy = timer.run.status === 'running' || timer.run.status === 'paused';
    if (busy && timer.entryId !== target.id) showToast(t('book.startReadingBusy', { title: target.book.title }));
    timer.requestReading(target.id);
    // Back to the existing tab group (a push would stack a second one, see HANDOFF).
    router.dismissTo('/together');
  };

  return <Button label={`📖 ${t('book.startReading')}`} variant={primary ? 'primary' : 'sky'} fullWidth onPress={start} />;
}
