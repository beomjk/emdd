export const messages: Record<string, string> = {
  // 건강 대시보드
  'health.title': 'EMDD 건강 대시보드',
  'health.total_nodes': '전체 노드 수',
  'health.by_type': '타입별 분포',
  'health.hypothesis_status': '가설 상태',
  'health.avg_confidence': '평균 신뢰도',
  'health.open_questions': '미해결 질문',
  'health.orphan_findings': '고아 발견사항',
  'health.link_density': '링크 밀도',
  'health.recent_activity': '최근 활동',
  'health.gaps': '구조적 공백',

  // CLI 설명
  'cli.description': '진화하는 마인드맵 주도 개발을 위한 CLI',
  'cli.init.desc': 'EMDD 프로젝트 초기화',
  'cli.new.desc': '새 노드 생성',
  'cli.health.desc': '건강 대시보드 표시',
  'cli.check.desc': '통합 트리거 확인',
  'cli.lint.desc': '그래프 스키마 및 링크 검증',
  'cli.promote.desc': '승격 후보 식별',
  'cli.index.desc': '_index.md 생성',
  'cli.graph.desc': '_graph.mmd 생성',
  'cli.update.desc': '노드 프론트매터 업데이트',
  'cli.link.desc': '노드 간 링크 추가',
  'cli.done.desc': '에피소드 항목 완료 표시',
  'cli.backlog.desc': '백로그 항목 표시',

  // 새 노드
  'new.created': '{type} 노드 생성됨: {id}',
  'new.invalid_type': '잘못된 노드 타입: {type}. 유효한 타입: {valid}',

  // 초기화
  'init.success': '{path}에 EMDD 프로젝트가 초기화되었습니다',
  'init.already_exists': '{path}에 EMDD 프로젝트가 이미 존재합니다',
  'init.next_steps': '다음: emdd new hypothesis <slug>',

  // 린트
  'lint.clean': '모든 노드가 유효합니다. 오류가 없습니다.',
  'lint.errors_found': '{count}개 오류 발견',
  'lint.warnings_found': '{count}개 경고 발견',
  'lint.missing_field': '필수 필드 누락: {field}',
  'lint.invalid_status': '타입 {type}에 대한 잘못된 상태 "{status}". 유효한 값: {valid}',
  'lint.confidence_range': '신뢰도는 0.0에서 1.0 사이여야 합니다. 입력값: {value}',
  'lint.invalid_relation': '잘못된 링크 관계: {relation}',
  'lint.broken_link': '링크 대상 "{target}"을(를) 그래프에서 찾을 수 없습니다',

  // 통합 확인
  'check.title': '통합 트리거 확인',
  'check.findings_threshold': '통합 대기 중인 발견사항: {count}개 (임계값: {threshold})',
  'check.episodes_threshold': '마지막 통합 이후 에피소드: {count}개 (임계값: {threshold})',
  'check.stale_hypothesis': '오래된 가설: {id} ({status} 상태로 {days}일)',
  'check.no_triggers': '활성화된 통합 트리거 없음',

  // 승격
  'promote.title': '승격 후보',
  'promote.candidate': '{id}: 신뢰도={confidence}, 지지={supports}',
  'promote.no_candidates': '승격 후보가 없습니다',

  // 업데이트
  'update.success': '{id} 업데이트됨: {field} = {value}',
  'update.node_not_found': '노드를 찾을 수 없습니다: {id}',

  // 링크
  'link.success': '{source} → {target} 연결됨 ({relation})',
  'link.invalid_relation': '잘못된 관계: {relation}. 유효한 값: {valid}',

  // 완료
  'done.success': '[{marker}]로 표시됨: {item}',
  'done.item_not_found': '{id}에서 항목을 찾을 수 없습니다: {item}',
  'done.invalid_marker': '잘못된 마커: {marker}. 유효한 마커: done, deferred, superseded',
  'done.already_marked': '{id}에서 이미 표시된 항목입니다: {item}',

  // 인덱스
  'index.generated': '_index.md 생성됨 ({nodes}개 노드)',

  // 그래프
  'graph.generated': '_graph.mmd 생성됨 ({nodes}개 노드, {edges}개 엣지)',

  // 백로그
  'backlog.title': '백로그 항목',
  'backlog.empty': '대기 중인 백로그 항목 없음',

  // 오류
  'error.graph_not_found': 'graph/ 디렉토리를 찾을 수 없습니다',
  'error.node_not_found': '노드를 찾을 수 없습니다: {id}',
  'error.invalid_node_type': '잘못된 노드 타입: {type}. 유효한 타입: {valid}',
  'error.invalid_strength': 'strength는 0.0에서 1.0 사이의 숫자여야 합니다. 입력값: {value}',
  'error.invalid_severity': '잘못된 severity "{value}". 유효한 값: {valid}',
  'error.invalid_completeness': 'completeness는 0.0에서 1.0 사이의 숫자여야 합니다. 입력값: {value}',
  'error.invalid_dependency_type': '잘못된 dependencyType "{value}". 유효한 값: {valid}',
  'error.invalid_impact': '잘못된 impact "{value}". 유효한 값: {valid}',
  'error.edge_affinity_invalid_attr': '에지 어피니티 위반: "{relation}"은(는) [{allowed}]만 허용하지만, 허용되지 않는 속성이 있습니다: [{invalid}]',
  'error.edge_affinity_no_attrs': '에지 어피니티 위반: "{relation}"은(는) 속성을 허용하지 않지만, 속성이 있습니다: [{invalid}]',
  'error.invalid_relation': '잘못된 관계: {relation}. 유효한 값: {valid}',
  'error.source_not_found': '소스 노드를 찾을 수 없습니다: {id}',
  'error.target_not_found': '대상 노드를 찾을 수 없습니다: {id}',
  'error.invalid_confidence': '잘못된 신뢰도 값: "{value}" (0-1 사이여야 합니다)',
  'error.invalid_status': '타입 {type}에 대한 잘못된 상태 "{value}". 유효한 값: {valid}',
  'error.invalid_finding_type': '잘못된 finding_type "{value}". 유효한 값: {valid}',
  'error.invalid_urgency': '잘못된 urgency "{value}". 유효한 값: {valid}',
  'error.invalid_risk_level': '잘못된 risk_level "{value}". 유효한 값: {valid}',
  'error.invalid_reversibility': '잘못된 reversibility "{value}". 유효한 값: {valid}',
  'error.no_matching_link': '{source}에서 {target}으로의 일치하는 링크가 없습니다{relation}',
  'error.invalid_marker': '잘못된 마커: {marker}. 유효한 마커: {valid}',
  'error.item_already_marked': '{id}에서 이미 표시된 항목입니다: {item}',
  'error.item_not_found': '{id}에서 항목을 찾을 수 없습니다: {item}',
  'error.multiple_matches': "'{item}'에 대한 복수 일치가 {id}에 있습니다",
};
