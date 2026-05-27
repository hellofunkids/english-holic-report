process.chdir('/home/runner/workspace/artifacts/api-server');
(async () => {
  const { buildAssessmentReportPdf } = await import('file:///home/runner/workspace/artifacts/api-server/src/lib/pdfBuilderAssessment.ts');
  const pdf = await buildAssessmentReportPdf({
    overallComment: '김지환 학생은 이번 평가에서 어휘 영역에서 매우 우수한 결과를 보였습니다. 다만 작문에서는 문장 구조의 다양성이 다소 부족한 모습이 관찰되었습니다. 꾸준한 영작 연습을 통해 충분히 보완 가능하며, 다음 평가에서의 발전이 기대됩니다.',
    strengths: [
      '단어 시험에서 90% 이상의 정확도를 보였으며 특히 어휘 활용이 우수합니다.',
      '기본 문장 구조를 정확하게 이해하고 활용하는 능력이 뛰어납니다.',
      '주어와 동사 일치 규칙을 잘 적용하여 자연스러운 문장을 만들어 냅니다.',
    ],
    improvements: [
      '동사 시제 활용에 약간의 혼동이 있어 과거형과 현재완료 구분 연습이 필요합니다.',
      '관사(a/an/the)의 사용에서 세심한 보완이 필요해 보입니다.',
      '복합 문장에서 접속사 사용이 단조로워 다양한 연결어 학습이 필요합니다.',
    ],
    nextSteps: [
      '매일 짧은 영어 일기 3-4문장 작성하고 부모님과 함께 소리내어 읽기',
      '동사 시제 카드를 활용한 5분 복습 활동 진행',
      '주 2회 그림 묘사 영작 연습 (5문장 이상)',
      '학원에서 진행하는 1:1 첨삭 케어 프로그램 참여',
    ],
    domainScores: { vocabulary: 92, grammar: 68, reading: 85, writing: 72 },
    totalScore: 79,
    bestSentence: {
      sentence: 'The little boy carefully opened the box and found a small puppy inside.',
      comment: '주어와 동사의 일치, 부사 활용, 복합 문장 구성까지 모두 자연스럽게 완성한 멋진 문장입니다.',
    },
    correctionExample: {
      original: 'The girl go to school yesterday.',
      corrected: 'The girl went to school yesterday.',
      reason: '"yesterday"가 있으니 과거 시제를 써야 합니다. go의 과거형은 went입니다.',
    },
    parentMessage: '어머님 아버님, 지환이는 이번 평가에서 탄탄한 어휘력과 안정된 문장 구성 능력을 보여주었습니다. 특히 어휘 영역의 점수가 매우 우수하여 앞으로의 학습 잠재력이 매우 기대됩니다. 다만 동사 시제와 관사 사용에서 조금 더 세심한 연습이 필요합니다. 가정에서 영어 일기 쓰기를 함께 해주시면 큰 도움이 될 거예요. 항상 응원합니다.',
  }, { studentName: '김지환', teacherName: '이현진 원장', testTitle: 'Bridge Reading 2', date: '2026. 5. 27.' });
  const m = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  console.log('PAGES:', m ? m.length : 0, 'BYTES:', pdf.length);
  require('node:fs').writeFileSync('/tmp/test_layout.pdf', pdf);
})().catch(e => { console.error(e); process.exit(1); });
