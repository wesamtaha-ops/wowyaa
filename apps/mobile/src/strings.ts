/**
 * Engineering placeholder copy. All child- and parent-facing Arabic must be rewritten and
 * signed off by the educator before beta (plan §13); keys are stable.
 */
export const strings = {
  appTitle: 'حُرُوفِي',
  loading: 'نُجَهِّزُ اللُّعْبَةَ…',
  offlineBadge: 'يَعْمَلُ بِدُونِ إِنْتَرْنِت',
  whoIsPlaying: 'مَنْ سَيَلْعَبُ؟',
  noProfiles: 'لَا يُوجَدُ لَاعِبُونَ بَعْدُ',
  addChild: 'أَضِفْ طِفْلًا',
  ageBand46: '٤–٦ سَنَوَات',
  ageBand79: '٧–٩ سَنَوَات',
  defaultChildName: (n: number) => `لَاعِب ${n}`,
  bootFailed: 'حَدَثَتْ مُشْكِلَةٌ فِي التَّشْغِيل',
  retry: 'حَاوِلْ مَرَّةً أُخْرَى',
  faseeh: 'فَصِيح',
  play: 'اِلْعَبْ',
  exit: 'رُجُوع',
  check: 'تَحَقَّقْ',
  undo: 'تَرَاجُع',
  hint: 'مُسَاعَدَة',
  next: 'التَّالِي',
  replay: 'اِسْمَعْ مَرَّةً أُخْرَى',
  emptySlot: 'مَكَانٌ فَارِغ',
  wordModel: 'كَوِّنِ الْكَلِمَة',
  progress: (n: number, total: number) => `${n} / ${total}`,
  sessionDone: 'أَحْسَنْتَ! انْتَهَتِ الْجَوْلَة',
  nothingToPlay: 'لَا تُوجَدُ أَلْعَابٌ جَاهِزَةٌ الْآن',
  /** Keyed by EvaluationResult.feedbackKey prefix; never a red "wrong" (plan §8.1). */
  feedback: {
    correct: 'رَائِع!',
    try_again: 'قَرِيبٌ! جَرِّبْ مَرَّةً أُخْرَى',
  },
} as const;

export function feedbackText(feedbackKey: string): string {
  return feedbackKey.endsWith('.correct') ? strings.feedback.correct : strings.feedback.try_again;
}
