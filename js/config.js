// 새봄약속 설정 파일 — 해마다 여기만 고치면 됩니다.
window.APP_CONFIG = {
  // 카드에 찍히는 해 (송구영신 예배 기준 '새해')
  YEAR: 2027,
  CHURCH: '새봄교회',
  APP_NAME: '새봄약속',

  // 말씀 데이터: 구글 시트 '말씀' 탭
  // 시트 공유 설정이 '링크가 있는 모든 사용자 - 뷰어'여야 앱이 읽을 수 있습니다.
  SHEET_ID: '1xIKWgznH_XDA9mZE7h50im3QJEOBGasQU-scOmhlNtc',
  SHEET_TAB: '말씀',

  // 뽑은 기록을 보낼 주소 (4단계에서 Apps Script 배포 후 채움). 비워 두면 기록을 보내지 않습니다.
  LOG_URL: '',

  // 시트를 못 읽을 때(개발·오프라인 첫 실행) 쓰는 예비 데이터
  SAMPLE_CSV: 'data/sample.csv',
};
