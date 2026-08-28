import { DetailedWordInfo } from '../types';

export class DictionaryService {
  public static defaultVocabDetails: Record<string, Partial<DetailedWordInfo>> = {
    smart: {
      part_of_speech: 'adjective (형용사)',
      phonetic: '/smɑːrt/',
      definition_en: 'Having or showing a high degree of mental ability; intelligent and sensible.',
      synonyms: ['intelligent', 'clever', 'wise', 'bright'],
      antonyms: ['foolish', 'unwise', 'stupid'],
      extra_examples: [
        'She made a smart decision by saving half of her salary.',
        'Smart shoppers always compare quality before buying.'
      ]
    },
    jacket: {
      part_of_speech: 'noun (명사)',
      phonetic: '/ˈdʒæk.ɪt/',
      definition_en: 'An outer garment extending either to the waist or the hips, typically having sleeves.',
      synonyms: ['coat', 'outerwear', 'blazer'],
      antonyms: [],
      extra_examples: [
        'It is getting chilly outside; put on your warm jacket.',
        'This leather jacket is stylish and durable.'
      ]
    },
    check: {
      part_of_speech: 'verb (동사)',
      phonetic: '/tʃek/',
      definition_en: 'To examine something in order to determine its accuracy, quality, or condition.',
      synonyms: ['examine', 'inspect', 'verify', 'investigate'],
      antonyms: ['ignore', 'neglect'],
      extra_examples: [
        'Please check your answers before submitting the test.',
        'I need to check the train schedule before leaving.'
      ]
    },
    price: {
      part_of_speech: 'noun (명사)',
      phonetic: '/praɪs/',
      definition_en: 'The amount of money expected, required, or given in payment for something.',
      synonyms: ['cost', 'charge', 'rate', 'value'],
      antonyms: [],
      extra_examples: [
        'The price of gasoline has dropped this week.',
        'Success often comes at the price of hard work.'
      ]
    }
  };

  public static async searchWord(query: string): Promise<DetailedWordInfo> {
    const term = query.trim().toLowerCase();
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${term}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition || '';
        const ex = meaning?.definitions?.[0]?.example || '';
        const syns = meaning?.synonyms?.slice(0, 4) || [];
        const phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';

        return {
          word: entry.word,
          meaning_ko: `(영영) ${def.slice(0, 40)}...`,
          part_of_speech: meaning?.partOfSpeech ? `${meaning.partOfSpeech}` : 'noun',
          phonetic: phonetic,
          definition_en: def,
          example: ex || `Let's use "${entry.word}" in a sentence.`,
          synonyms: syns,
          extra_examples: meaning?.definitions?.slice(1, 3).map((d: any) => d.example).filter(Boolean) || []
        };
      }
    } catch {}

    return {
      word: term,
      meaning_ko: '사전 검색 결과',
      part_of_speech: 'word',
      definition_en: `Lookup for "${term}".`,
      example: `Example sentence for "${term}".`
    };
  }
}
