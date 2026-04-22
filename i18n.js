// ===== MANTUBE i18n — Multi-Language System =====

const TRANSLATIONS = {
  id: {
    // Nav
    nav_beranda: 'Beranda', nav_musik: 'Musik', nav_files: 'File Saya', nav_settings: 'Pengaturan',
    // Topbar
    search_placeholder: 'Cari atau tempel tautan di sini',
    // Beranda
    feed_loading: 'Memuat video terbaru...', feed_error: 'Gagal memuat. Periksa koneksi server.',
    feed_retry: 'Coba Lagi', feed_refresh: 'Feed diperbarui',
    // Musik
    musik_title: 'Musik', musik_trending_shorts: 'Sedang Trending di Shorts',
    musik_new_trend: 'Yang Baru & Sedang Trend 🔥', musik_hits: 'Hits Indonesia.',
    musik_rilis: 'Rilis baru', musik_favorit: 'Favorit selamanya! 🤎',
    // File Saya
    files_title: 'File Saya', files_downloaded: 'Sudah Diunduh', files_empty: 'Belum ada file yang diunduh',
    // Pengaturan
    settings_title: 'Pengaturan', settings_login: 'Masuk', settings_language: 'Bahasa',
    settings_playback: 'Pengaturan Pemutaran', settings_quick_search: 'Pencarian Cepat',
    settings_about: 'Tentang Kami', settings_follow_ig: 'Follow us on IG',
    settings_share: 'Bagikan ManTube', settings_suggest: 'Saran', settings_update: 'Memperbarui',
    settings_privacy: 'Kebijakan Pribadi',
    // Download
    download_title: 'Unduh sebagai', download_audio: 'Audio saja (M4A)', download_video: 'Video (MP4)',
    download_cancel: 'Batal', download_btn: 'Unduh', download_loading: 'Memuat format tersedia...',
    download_music_section: 'Musik', download_video_section: 'Video',
    download_path: 'Path: /storage/emulated/0/Download/ManTube',
    download_start: 'Memulai unduhan...', download_done: 'Tersimpan ke Downloads',
    download_fail: 'Gagal mengunduh',
    // Player
    player_subscribe: 'Subscribe', player_join: 'Join', player_share: 'Share', player_unduh: 'Unduh',
    player_no_desc: 'Tidak ada deskripsi.', player_more: '...more', player_hide: 'Sembunyikan',
    player_related: 'Video Terkait',
    // Search
    search_music_title: 'Cari Musik', search_history: 'Pencarian Terakhir', search_clear_all: 'Hapus Semua',
    search_no_history: 'Belum ada riwayat pencarian', search_not_found: 'Musik tidak ditemukan',
    search_not_found_sub: 'Tidak ada hasil musik untuk', search_try_again: 'Cari Lagi',
    search_results: 'hasil untuk',
    // Language modal
    lang_title: 'Bahasa', lang_current: 'Bahasa saat ini', lang_all: 'Semua bahasa', lang_close: 'Tutup',
    // Toast
    toast_lang_changed: 'Bahasa diubah ke',
    toast_quick_on: 'Pencarian Cepat: Aktif', toast_quick_off: 'Pencarian Cepat: Nonaktif',
    toast_copied: 'Link disalin ke clipboard', toast_file_deleted: 'dihapus',
    toast_all_deleted: 'Semua file dihapus', toast_no_files: 'Tidak ada file untuk dihapus',
    toast_subscribed: 'Subscribe di YouTube!', toast_join: 'Fitur Join segera hadir',
    toast_dislike: 'Dislike dicatat', toast_refreshed: 'Video di-refresh',
    toast_privacy: 'Kebijakan Privasi: Kami tidak menyimpan data pribadi Anda.',
    toast_version: 'Versi 1.0.0 - Sudah terbaru', toast_suggest: 'Kirim saran ke: saran@mantube.app',
    toast_login: 'Fitur login segera hadir', toast_lang_id: 'Bahasa: Indonesia',
    toast_playback: 'Pengaturan Pemutaran',
  },
  en: {
    nav_beranda: 'Home', nav_musik: 'Music', nav_files: 'My Files', nav_settings: 'Settings',
    search_placeholder: 'Search or paste link here',
    feed_loading: 'Loading latest videos...', feed_error: 'Failed to load. Check server connection.',
    feed_retry: 'Try Again', feed_refresh: 'Feed updated',
    musik_title: 'Music', musik_trending_shorts: 'Trending in Shorts',
    musik_new_trend: 'New & Trending 🔥', musik_hits: 'Indonesia Hits.',
    musik_rilis: 'New Releases', musik_favorit: 'All-time Favorites! 🤎',
    files_title: 'My Files', files_downloaded: 'Downloaded', files_empty: 'No files downloaded yet',
    settings_title: 'Settings', settings_login: 'Sign In', settings_language: 'Language',
    settings_playback: 'Playback Settings', settings_quick_search: 'Quick Search',
    settings_about: 'About Us', settings_follow_ig: 'Follow us on IG',
    settings_share: 'Share ManTube', settings_suggest: 'Feedback', settings_update: 'Update',
    settings_privacy: 'Privacy Policy',
    download_title: 'Download as', download_audio: 'Audio only (M4A)', download_video: 'Video (MP4)',
    download_cancel: 'Cancel', download_btn: 'Download', download_loading: 'Loading available formats...',
    download_music_section: 'Music', download_video_section: 'Video',
    download_path: 'Path: /storage/emulated/0/Download/ManTube',
    download_start: 'Starting download...', download_done: 'Saved to Downloads',
    download_fail: 'Download failed',
    player_subscribe: 'Subscribe', player_join: 'Join', player_share: 'Share', player_unduh: 'Download',
    player_no_desc: 'No description.', player_more: '...more', player_hide: 'Hide',
    player_related: 'Related Videos',
    search_music_title: 'Search Music', search_history: 'Recent Searches', search_clear_all: 'Clear All',
    search_no_history: 'No search history yet', search_not_found: 'Music not found',
    search_not_found_sub: 'No music results for', search_try_again: 'Search Again',
    search_results: 'results for',
    lang_title: 'Language', lang_current: 'Current language', lang_all: 'All languages', lang_close: 'Close',
    toast_lang_changed: 'Language changed to',
    toast_quick_on: 'Quick Search: On', toast_quick_off: 'Quick Search: Off',
    toast_copied: 'Link copied to clipboard', toast_file_deleted: 'deleted',
    toast_all_deleted: 'All files deleted', toast_no_files: 'No files to delete',
    toast_subscribed: 'Subscribe on YouTube!', toast_join: 'Join feature coming soon',
    toast_dislike: 'Dislike noted', toast_refreshed: 'Video refreshed',
    toast_privacy: 'Privacy Policy: We do not store your personal data.',
    toast_version: 'Version 1.0.0 - Up to date', toast_suggest: 'Send feedback to: feedback@mantube.app',
    toast_login: 'Login feature coming soon', toast_lang_id: 'Language: English',
    toast_playback: 'Playback Settings',
  },
  ar: {
    nav_beranda: 'الرئيسية', nav_musik: 'موسيقى', nav_files: 'ملفاتي', nav_settings: 'الإعدادات',
    search_placeholder: 'ابحث أو الصق رابطاً هنا',
    feed_loading: 'جارٍ تحميل أحدث الفيديوهات...', feed_error: 'فشل التحميل. تحقق من الاتصال.',
    feed_retry: 'حاول مجدداً', feed_refresh: 'تم تحديث الخلاصة',
    musik_title: 'موسيقى', musik_trending_shorts: 'رائج في Shorts',
    musik_new_trend: 'جديد ورائج 🔥', musik_hits: 'أفضل الأغاني.',
    musik_rilis: 'إصدارات جديدة', musik_favorit: 'المفضلة دائماً! 🤎',
    files_title: 'ملفاتي', files_downloaded: 'تم التنزيل', files_empty: 'لا توجد ملفات محملة',
    settings_title: 'الإعدادات', settings_login: 'تسجيل الدخول', settings_language: 'اللغة',
    settings_playback: 'إعدادات التشغيل', settings_quick_search: 'البحث السريع',
    settings_about: 'معلومات عنا', settings_follow_ig: 'تابعنا على IG',
    settings_share: 'شارك ManTube', settings_suggest: 'اقتراح', settings_update: 'تحديث',
    settings_privacy: 'سياسة الخصوصية',
    download_title: 'تنزيل بصيغة', download_audio: 'صوت فقط (M4A)', download_video: 'فيديو (MP4)',
    download_cancel: 'إلغاء', download_btn: 'تنزيل', download_loading: 'جارٍ تحميل الصيغ...',
    download_music_section: 'موسيقى', download_video_section: 'فيديو',
    download_path: 'المسار: /storage/emulated/0/Download/ManTube',
    download_start: 'بدء التنزيل...', download_done: 'تم الحفظ في التنزيلات',
    download_fail: 'فشل التنزيل',
    player_subscribe: 'اشتراك', player_join: 'انضمام', player_share: 'مشاركة', player_unduh: 'تنزيل',
    player_no_desc: 'لا يوجد وصف.', player_more: '...المزيد', player_hide: 'إخفاء',
    player_related: 'فيديوهات ذات صلة',
    search_music_title: 'بحث موسيقى', search_history: 'عمليات البحث الأخيرة', search_clear_all: 'مسح الكل',
    search_no_history: 'لا يوجد سجل بحث', search_not_found: 'لم يتم العثور على موسيقى',
    search_not_found_sub: 'لا توجد نتائج موسيقية لـ', search_try_again: 'ابحث مجدداً',
    search_results: 'نتيجة لـ',
    lang_title: 'اللغة', lang_current: 'اللغة الحالية', lang_all: 'جميع اللغات', lang_close: 'إغلاق',
    toast_lang_changed: 'تم تغيير اللغة إلى',
    toast_quick_on: 'البحث السريع: مفعّل', toast_quick_off: 'البحث السريع: معطّل',
    toast_copied: 'تم نسخ الرابط', toast_file_deleted: 'تم الحذف',
    toast_all_deleted: 'تم حذف جميع الملفات', toast_no_files: 'لا توجد ملفات للحذف',
    toast_subscribed: 'اشترك على يوتيوب!', toast_join: 'ميزة الانضمام قريباً',
    toast_dislike: 'تم تسجيل عدم الإعجاب', toast_refreshed: 'تم تحديث الفيديو',
    toast_privacy: 'سياسة الخصوصية: لا نحتفظ ببياناتك الشخصية.',
    toast_version: 'الإصدار 1.0.0 - محدّث', toast_suggest: 'أرسل اقتراحاً: feedback@mantube.app',
    toast_login: 'ميزة تسجيل الدخول قريباً', toast_lang_id: 'اللغة: العربية',
    toast_playback: 'إعدادات التشغيل',
  },
  zh: {
    nav_beranda: '首页', nav_musik: '音乐', nav_files: '我的文件', nav_settings: '设置',
    search_placeholder: '搜索或粘贴链接',
    feed_loading: '加载最新视频...', feed_error: '加载失败，请检查服务器连接。',
    feed_retry: '重试', feed_refresh: '动态已更新',
    musik_title: '音乐', musik_trending_shorts: 'Shorts 热门',
    musik_new_trend: '新品与热门 🔥', musik_hits: '印尼热门歌曲',
    musik_rilis: '新发行', musik_favorit: '永恒最爱 🤎',
    files_title: '我的文件', files_downloaded: '已下载', files_empty: '暂无已下载文件',
    settings_title: '设置', settings_login: '登录', settings_language: '语言',
    settings_playback: '播放设置', settings_quick_search: '快速搜索',
    settings_about: '关于我们', settings_follow_ig: '关注我们的 IG',
    settings_share: '分享 ManTube', settings_suggest: '建议', settings_update: '更新',
    settings_privacy: '隐私政策',
    download_title: '下载为', download_audio: '仅音频 (M4A)', download_video: '视频 (MP4)',
    download_cancel: '取消', download_btn: '下载', download_loading: '加载可用格式...',
    download_music_section: '音乐', download_video_section: '视频',
    download_path: '路径: /storage/emulated/0/Download/ManTube',
    download_start: '开始下载...', download_done: '已保存到下载',
    download_fail: '下载失败',
    player_subscribe: '订阅', player_join: '加入', player_share: '分享', player_unduh: '下载',
    player_no_desc: '暂无描述。', player_more: '...更多', player_hide: '收起',
    player_related: '相关视频',
    search_music_title: '搜索音乐', search_history: '最近搜索', search_clear_all: '全部清除',
    search_no_history: '暂无搜索记录', search_not_found: '未找到音乐',
    search_not_found_sub: '没有找到相关音乐', search_try_again: '重新搜索',
    search_results: '个结果',
    lang_title: '语言', lang_current: '当前语言', lang_all: '所有语言', lang_close: '关闭',
    toast_lang_changed: '语言已更改为',
    toast_quick_on: '快速搜索：开启', toast_quick_off: '快速搜索：关闭',
    toast_copied: '链接已复制', toast_file_deleted: '已删除',
    toast_all_deleted: '所有文件已删除', toast_no_files: '没有文件可删除',
    toast_subscribed: '在 YouTube 上订阅！', toast_join: '加入功能即将推出',
    toast_dislike: '已记录不喜欢', toast_refreshed: '视频已刷新',
    toast_privacy: '隐私政策：我们不存储您的个人数据。',
    toast_version: '版本 1.0.0 - 已是最新', toast_suggest: '发送建议至: feedback@mantube.app',
    toast_login: '登录功能即将推出', toast_lang_id: '语言：中文',
    toast_playback: '播放设置',
  },
  ja: {
    nav_beranda: 'ホーム', nav_musik: '音楽', nav_files: 'マイファイル', nav_settings: '設定',
    search_placeholder: '検索またはリンクを貼り付け',
    feed_loading: '最新動画を読み込み中...', feed_error: '読み込み失敗。接続を確認してください。',
    feed_retry: '再試行', feed_refresh: 'フィードを更新しました',
    musik_title: '音楽', musik_trending_shorts: 'Shortsのトレンド',
    musik_new_trend: '新着＆トレンド 🔥', musik_hits: 'インドネシアヒット',
    musik_rilis: '新リリース', musik_favorit: '永遠のお気に入り 🤎',
    files_title: 'マイファイル', files_downloaded: 'ダウンロード済み', files_empty: 'ダウンロードファイルなし',
    settings_title: '設定', settings_login: 'ログイン', settings_language: '言語',
    settings_playback: '再生設定', settings_quick_search: 'クイック検索',
    settings_about: '私たちについて', settings_follow_ig: 'IGをフォロー',
    settings_share: 'ManTubeをシェア', settings_suggest: 'フィードバック', settings_update: '更新',
    settings_privacy: 'プライバシーポリシー',
    download_title: 'ダウンロード形式', download_audio: '音声のみ (M4A)', download_video: '動画 (MP4)',
    download_cancel: 'キャンセル', download_btn: 'ダウンロード', download_loading: '形式を読み込み中...',
    download_music_section: '音楽', download_video_section: '動画',
    download_path: 'パス: /storage/emulated/0/Download/ManTube',
    download_start: 'ダウンロード開始...', download_done: 'ダウンロードに保存しました',
    download_fail: 'ダウンロード失敗',
    player_subscribe: '登録', player_join: '参加', player_share: 'シェア', player_unduh: 'DL',
    player_no_desc: '説明なし。', player_more: '...もっと見る', player_hide: '閉じる',
    player_related: '関連動画',
    search_music_title: '音楽を検索', search_history: '最近の検索', search_clear_all: 'すべて削除',
    search_no_history: '検索履歴なし', search_not_found: '音楽が見つかりません',
    search_not_found_sub: '音楽の結果なし', search_try_again: '再検索',
    search_results: '件の結果',
    lang_title: '言語', lang_current: '現在の言語', lang_all: 'すべての言語', lang_close: '閉じる',
    toast_lang_changed: '言語を変更しました:',
    toast_quick_on: 'クイック検索: オン', toast_quick_off: 'クイック検索: オフ',
    toast_copied: 'リンクをコピーしました', toast_file_deleted: '削除しました',
    toast_all_deleted: 'すべてのファイルを削除', toast_no_files: '削除するファイルなし',
    toast_subscribed: 'YouTubeで登録！', toast_join: '参加機能は近日公開',
    toast_dislike: '低評価を記録', toast_refreshed: '動画を更新しました',
    toast_privacy: 'プライバシーポリシー: 個人データは保存しません。',
    toast_version: 'バージョン 1.0.0 - 最新', toast_suggest: 'フィードバック: feedback@mantube.app',
    toast_login: 'ログイン機能は近日公開', toast_lang_id: '言語: 日本語',
    toast_playback: '再生設定',
  },
  ko: {
    nav_beranda: '홈', nav_musik: '음악', nav_files: '내 파일', nav_settings: '설정',
    search_placeholder: '검색하거나 링크를 붙여넣으세요',
    feed_loading: '최신 동영상 로딩 중...', feed_error: '로드 실패. 서버 연결을 확인하세요.',
    feed_retry: '다시 시도', feed_refresh: '피드가 업데이트되었습니다',
    musik_title: '음악', musik_trending_shorts: 'Shorts 트렌딩',
    musik_new_trend: '신규 & 트렌딩 🔥', musik_hits: '인도네시아 히트',
    musik_rilis: '신규 발매', musik_favorit: '영원한 즐겨찾기 🤎',
    files_title: '내 파일', files_downloaded: '다운로드됨', files_empty: '다운로드된 파일 없음',
    settings_title: '설정', settings_login: '로그인', settings_language: '언어',
    settings_playback: '재생 설정', settings_quick_search: '빠른 검색',
    settings_about: '소개', settings_follow_ig: 'IG 팔로우',
    settings_share: 'ManTube 공유', settings_suggest: '피드백', settings_update: '업데이트',
    settings_privacy: '개인정보 처리방침',
    download_title: '다운로드 형식', download_audio: '오디오만 (M4A)', download_video: '동영상 (MP4)',
    download_cancel: '취소', download_btn: '다운로드', download_loading: '형식 로딩 중...',
    download_music_section: '음악', download_video_section: '동영상',
    download_path: '경로: /storage/emulated/0/Download/ManTube',
    download_start: '다운로드 시작...', download_done: '다운로드에 저장됨',
    download_fail: '다운로드 실패',
    player_subscribe: '구독', player_join: '가입', player_share: '공유', player_unduh: '다운로드',
    player_no_desc: '설명 없음.', player_more: '...더보기', player_hide: '숨기기',
    player_related: '관련 동영상',
    search_music_title: '음악 검색', search_history: '최근 검색', search_clear_all: '모두 지우기',
    search_no_history: '검색 기록 없음', search_not_found: '음악을 찾을 수 없습니다',
    search_not_found_sub: '음악 결과 없음', search_try_again: '다시 검색',
    search_results: '개 결과',
    lang_title: '언어', lang_current: '현재 언어', lang_all: '모든 언어', lang_close: '닫기',
    toast_lang_changed: '언어가 변경되었습니다:',
    toast_quick_on: '빠른 검색: 켜짐', toast_quick_off: '빠른 검색: 꺼짐',
    toast_copied: '링크가 복사되었습니다', toast_file_deleted: '삭제됨',
    toast_all_deleted: '모든 파일 삭제됨', toast_no_files: '삭제할 파일 없음',
    toast_subscribed: 'YouTube에서 구독!', toast_join: '가입 기능 곧 출시',
    toast_dislike: '싫어요 기록됨', toast_refreshed: '동영상 새로고침됨',
    toast_privacy: '개인정보 처리방침: 개인 데이터를 저장하지 않습니다.',
    toast_version: '버전 1.0.0 - 최신', toast_suggest: '피드백: feedback@mantube.app',
    toast_login: '로그인 기능 곧 출시', toast_lang_id: '언어: 한국어',
    toast_playback: '재생 설정',
  },
};

// Fallback ke Indonesia jika key tidak ada
function t(key) {
  const lang = window._appLang || 'id';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['id'];
  return dict[key] || TRANSLATIONS['id'][key] || key;
}

// Terapkan bahasa ke seluruh UI
function applyLanguage(lang) {
  window._appLang = lang;
  localStorage.setItem('mantube_lang', lang);

  // Nav labels
  const navLabels = {
    beranda: t('nav_beranda'), musik: t('nav_musik'),
    files: t('nav_files'), settings: t('nav_settings'),
  };
  document.querySelectorAll('.nav-item').forEach(btn => {
    const tab  = btn.dataset.tab;
    const span = btn.querySelector('span');
    if (span && navLabels[tab]) span.textContent = navLabels[tab];
  });

  // Search placeholder
  const si = document.getElementById('searchInput');
  if (si) si.placeholder = t('search_placeholder');

  // Page titles
  const fileTitleEl = document.querySelector('#page-files .page-title');
  if (fileTitleEl) fileTitleEl.textContent = t('files_title');

  const settingsTitleEl = document.querySelector('#page-settings .page-title');
  if (settingsTitleEl) settingsTitleEl.textContent = t('settings_title');

  const musikTitleEl = document.querySelector('.musik-topbar-title');
  if (musikTitleEl) musikTitleEl.textContent = t('musik_title');

  // Files subtitle
  const filesSub = document.querySelector('.files-subtitle');
  if (filesSub) {
    const badge = filesSub.querySelector('#fileCount');
    const count = badge ? badge.outerHTML : '';
    filesSub.innerHTML = t('files_downloaded') + ' ' + count;
  }

  // Settings items
  _setSettingsText('settings_login',    t('settings_login'));
  _setSettingsText('settings_language', t('settings_language'));
  _setSettingsText('settings_playback', t('settings_playback'));
  _setSettingsText('settings_quick_search', t('settings_quick_search'));
  _setSettingsText('settings_follow_ig', t('settings_follow_ig'));
  _setSettingsText('settings_share',    t('settings_share'));
  _setSettingsText('settings_suggest',  t('settings_suggest'));
  _setSettingsText('settings_update',   t('settings_update'));
  _setSettingsText('settings_privacy',  t('settings_privacy'));

  // Musik section titles
  const sectionMap = {
    'musikTrendingShorts': 'musik_trending_shorts',
    'musikTrendingNew':    'musik_new_trend',
    'musikHitsIndo':       'musik_hits',
    'musikRilisBaru':      'musik_rilis',
    'musikFavorit':        'musik_favorit',
  };
  Object.entries(sectionMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      const titleEl = el.closest('.musik-section')?.querySelector('.musik-section-title');
      if (titleEl) titleEl.textContent = t(key);
    }
  });

  // RTL untuk bahasa Arab
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

function _setSettingsText(key, text) {
  // Cari berdasarkan data-i18n attribute
  const el = document.querySelector(`[data-i18n="${key}"]`);
  if (el) el.textContent = text;
}

// Init bahasa dari localStorage
function initLanguage() {
  const saved = localStorage.getItem('mantube_lang') || 'id';
  window._appLang = saved;
  applyLanguage(saved);
}
