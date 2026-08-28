export class SpeechService {
  public static speakWord(text: string): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('이 브라우저는 음성 재생(TTS)을 지원하지 않습니다.');
    }
  }

  public static calculateAccuracy(target: string, input: string): number {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const cleanInput = input.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (!cleanInput) return 0;
    if (cleanTarget === cleanInput) return 100;

    const targetWords = cleanTarget.split(/\s+/);
    const inputWords = cleanInput.split(/\s+/);
    let matchCount = 0;

    targetWords.forEach(w => {
      if (inputWords.includes(w)) matchCount++;
    });

    return Math.round((matchCount / Math.max(targetWords.length, 1)) * 100);
  }

  public static getClozeSentence(text: string): string {
    const words = text.split(' ');
    return words.map((w, i) => {
      const cleanW = w.replace(/[^a-zA-Z]/g, '');
      if (cleanW.length > 3 && (i % 2 === 1)) {
        return cleanW[0] + '_'.repeat(cleanW.length - 1);
      }
      return w;
    }).join(' ');
  }
}
