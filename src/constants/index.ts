import type { LiveSlide, LiveCard, ProductCard, DeptCard, CategoryChip, AgeSegment, LiveStream, Brand, CartItem, UserProfile, ChatMessage } from '../types'

export const LIVE_SLIDES: LiveSlide[] = [
  {
    id: 1,
    hostName: '설화수 공식 BA',
    deptName: '현대백화점관',
    deptKey: 'hyundai',
    viewers: 3243,
    productName: '자음생 에센스 크림 60ml',
    price: 320000,
    originalPrice: 360000,
    bgColor: '#2a1a2e',
    avatarColor: '#993556',
    avatarInitial: '설',
  },
  {
    id: 2,
    hostName: '랑콤 공식 BA',
    deptName: '롯데백화점관',
    deptKey: 'lotte',
    viewers: 2431,
    productName: '제니피끄 어드밴스드 세럼 50ml',
    price: 198000,
    bgColor: '#0d1f18',
    avatarColor: '#0F6E56',
    avatarInitial: '랑',
  },
  {
    id: 3,
    hostName: '라메르 공식 BA',
    deptName: '현대백화점관',
    deptKey: 'hyundai',
    viewers: 1887,
    productName: '크렘 드 라 메르 30ml',
    price: 420000,
    originalPrice: 470000,
    bgColor: '#0d1428',
    avatarColor: '#185FA5',
    avatarInitial: '라',
  },
]

export const CATEGORIES: CategoryChip[] = [
  { id: 'skincare', label: '스킨케어', icon: '✨', bg: '#FBEAF0', color: '#993556' },
  { id: 'makeup', label: '메이크업', icon: '🎨', bg: '#EEEDFE', color: '#534AB7' },
  { id: 'perfume', label: '향수', icon: '💧', bg: '#E1F5EE', color: '#0F6E56' },
  { id: 'hair', label: '헤어케어', icon: '✂️', bg: '#FAEEDA', color: '#854F0B' },
  { id: 'body', label: '바디케어', icon: '🤍', bg: '#E6F1FB', color: '#185FA5' },
]

export const DEPT_CARDS: DeptCard[] = [
  {
    key: 'lotte',
    name: '롯데백화점관',
    brandCount: 18,
    bgColor: '#FAECE7',
    textColor: '#712B13',
    accentColor: '#D85A30',
  },
  {
    key: 'shinsegae',
    name: '신세계백화점관',
    brandCount: 16,
    bgColor: '#E1F5EE',
    textColor: '#085041',
    accentColor: '#1D9E75',
  },
  {
    key: 'hyundai',
    name: '현대백화점관',
    brandCount: 15,
    isVip: true,
    bgColor: '#EEEDFE',
    textColor: '#3C3489',
    accentColor: '#7F77DD',
  },
]

export const LIVE_CARDS: LiveCard[] = [
  {
    id: 1,
    brand: '설화수',
    deptName: '현대백화점관',
    deptKey: 'hyundai',
    productName: '자음생 에센스 크림 60ml',
    price: 320000,
    viewers: 3243,
    isLive: true,
    thumbColor: '#2a1a2e',
  },
  {
    id: 2,
    brand: '랑콤',
    deptName: '롯데백화점관',
    deptKey: 'lotte',
    productName: '제니피끄 어드밴스드 세럼 50ml',
    price: 198000,
    viewers: 2431,
    isLive: true,
    thumbColor: '#0d1f18',
  },
]

export const RECOMMENDED_PRODUCTS: ProductCard[] = [
  {
    id: 1,
    brand: '라메르',
    name: '크렘 드 라 메르 30ml',
    price: 420000,
    deptName: '현대',
    deptKey: 'hyundai',
    thumbIcon: '🌊',
    thumbColor: '#0d1428',
  },
  {
    id: 2,
    brand: '키엘',
    name: '울트라 페이셜 크림 125ml',
    price: 68000,
    originalPrice: 75000,
    deptName: '신세계',
    deptKey: 'shinsegae',
    thumbIcon: '🌿',
    thumbColor: '#0d1f18',
  },
  {
    id: 3,
    brand: '샤넬 뷰티',
    name: '루쥬 알뤼르 립스틱',
    price: 62000,
    deptName: '신세계',
    deptKey: 'shinsegae',
    thumbIcon: '💄',
    thumbColor: '#2a0d1a',
  },
  {
    id: 4,
    brand: '에스티로더',
    name: '어드밴스드 나이트 리페어',
    price: 165000,
    originalPrice: 180000,
    deptName: '롯데',
    deptKey: 'lotte',
    thumbIcon: '⭐',
    thumbColor: '#1a1208',
  },
]

export const AGE_SEGMENTS: AgeSegment[] = [
  {
    group: '30s',
    label: '30대',
    keywords: ['트렌드', '가성비', '멀티기능'],
    bgColor: '#FBEAF0',
    textColor: '#993556',
    accentColor: '#c4547a',
  },
  {
    group: '40s',
    label: '40대',
    keywords: ['안티에이징', '탄력', '프리미엄'],
    bgColor: '#E1F5EE',
    textColor: '#0F6E56',
    accentColor: '#1D9E75',
  },
  {
    group: '50s',
    label: '50대',
    keywords: ['보습', '재생', '명품 브랜드'],
    bgColor: '#EEEDFE',
    textColor: '#3C3489',
    accentColor: '#7F77DD',
  },
]

export const DEPT_COLOR = {
  lotte: { bg: '#FAECE7', text: '#712B13', accent: '#D85A30' },
  shinsegae: { bg: '#E1F5EE', text: '#085041', accent: '#1D9E75' },
  hyundai: { bg: '#EEEDFE', text: '#3C3489', accent: '#7F77DD' },
} as const

export const ALL_PRODUCTS: ProductCard[] = [
  { id: 1, brand: '설화수', name: '자음생 에센스 크림 60ml', price: 320000, originalPrice: 360000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '🌸', thumbColor: '#2a1a2e' },
  { id: 2, brand: '랑콤', name: '제니피끄 어드밴스드 세럼 50ml', price: 198000, deptName: '롯데', deptKey: 'lotte', thumbIcon: '💫', thumbColor: '#0d1f18' },
  { id: 3, brand: '라메르', name: '크렘 드 라 메르 30ml', price: 420000, originalPrice: 470000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '🌊', thumbColor: '#0d1428' },
  { id: 4, brand: '키엘', name: '울트라 페이셜 크림 125ml', price: 68000, originalPrice: 75000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '🌿', thumbColor: '#0d1f18' },
  { id: 5, brand: '샤넬 뷰티', name: '루쥬 알뤼르 립스틱', price: 62000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '💄', thumbColor: '#2a0d1a' },
  { id: 6, brand: '에스티로더', name: '어드밴스드 나이트 리페어 50ml', price: 165000, originalPrice: 180000, deptName: '롯데', deptKey: 'lotte', thumbIcon: '⭐', thumbColor: '#1a1208' },
  { id: 7, brand: '헤라', name: '블랙 쿠션 파운데이션 15g', price: 68000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '🖤', thumbColor: '#1a1a2a' },
  { id: 8, brand: 'SK-II', name: 'PITERA 에센스 230ml', price: 178000, originalPrice: 200000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '✨', thumbColor: '#1a1508' },
  { id: 9, brand: '나스', name: '블러시 파우더 4.8g', price: 55000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '🌹', thumbColor: '#2a0a18' },
  { id: 10, brand: '비오템', name: '아쿠아소스 크림 50ml', price: 72000, originalPrice: 82000, deptName: '롯데', deptKey: 'lotte', thumbIcon: '💙', thumbColor: '#0a1a2a' },
  { id: 11, brand: '클라란스', name: '더블 세럼 50ml', price: 145000, deptName: '롯데', deptKey: 'lotte', thumbIcon: '🌺', thumbColor: '#2a0d18' },
  { id: 12, brand: 'YSL', name: '루즈 볼뤼프테 샤인 립스틱', price: 58000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '👄', thumbColor: '#1a0a18' },
  { id: 13, brand: 'MAC', name: '스튜디오 픽스 파우더 15g', price: 52000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '🎭', thumbColor: '#1a1a1a' },
  { id: 14, brand: '설화수', name: '윤조 에센스 75ml', price: 145000, originalPrice: 160000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '🌸', thumbColor: '#2a1820' },
  { id: 15, brand: '아모레퍼시픽', name: '타임 레스폰스 스킨 토닉', price: 198000, deptName: '현대', deptKey: 'hyundai', thumbIcon: '🍵', thumbColor: '#1a2a1a' },
  { id: 16, brand: '바비브라운', name: '스킨 파운데이션 SPF15', price: 73000, deptName: '신세계', deptKey: 'shinsegae', thumbIcon: '🎨', thumbColor: '#2a1a10' },
]

export const ALL_LIVE_STREAMS: LiveStream[] = [
  {
    id: 1, brand: '설화수', deptName: '현대백화점관', deptKey: 'hyundai',
    productName: '자음생 에센스 크림 60ml', price: 320000, viewers: 3243,
    isLive: true, thumbColor: '#2a1a2e',
    hostName: '설화수 공식 BA 이지현', hostDesc: '설화수 전문 뷰티 어드바이저 12년 경력',
    avatarInitial: '설', avatarColor: '#993556', bgColor: '#2a1a2e',
    likes: 4821,
    products: ALL_PRODUCTS.filter(p => p.brand === '설화수'),
  },
  {
    id: 2, brand: '랑콤', deptName: '롯데백화점관', deptKey: 'lotte',
    productName: '제니피끄 어드밴스드 세럼 50ml', price: 198000, viewers: 2431,
    isLive: true, thumbColor: '#0d1f18',
    hostName: '랑콤 공식 BA 박수진', hostDesc: '랑콤 코리아 공인 뷰티 트레이너',
    avatarInitial: '랑', avatarColor: '#0F6E56', bgColor: '#0d1f18',
    likes: 3102,
    products: ALL_PRODUCTS.filter(p => p.brand === '랑콤'),
  },
  {
    id: 3, brand: '라메르', deptName: '현대백화점관', deptKey: 'hyundai',
    productName: '크렘 드 라 메르 30ml', price: 420000, originalPrice: 470000, viewers: 1887,
    isLive: true, thumbColor: '#0d1428',
    hostName: '라메르 공식 BA 김민서', hostDesc: '라메르 VIP 전담 어드바이저',
    avatarInitial: '라', avatarColor: '#185FA5', bgColor: '#0d1428',
    likes: 2980,
    products: ALL_PRODUCTS.filter(p => p.brand === '라메르'),
  },
  {
    id: 4, brand: '키엘', deptName: '신세계백화점관', deptKey: 'shinsegae',
    productName: '울트라 페이셜 크림 125ml', price: 68000, originalPrice: 75000, viewers: 0,
    isLive: false, thumbColor: '#0a2010',
    hostName: '키엘 공식 BA 최예린', hostDesc: '키엘 스킨케어 전문 어드바이저',
    avatarInitial: '키', avatarColor: '#1D9E75', bgColor: '#0a2010',
    scheduledAt: '오후 7:00',
    likes: 0,
    products: ALL_PRODUCTS.filter(p => p.brand === '키엘'),
  },
  {
    id: 5, brand: '헤라', deptName: '현대백화점관', deptKey: 'hyundai',
    productName: '블랙 쿠션 파운데이션 15g', price: 68000, viewers: 0,
    isLive: false, thumbColor: '#1a1a2a',
    hostName: '헤라 공식 BA 한지수', hostDesc: '헤라 메이크업 아티스트',
    avatarInitial: '헤', avatarColor: '#7F77DD', bgColor: '#1a1a2a',
    scheduledAt: '오후 8:30',
    likes: 0,
    products: ALL_PRODUCTS.filter(p => p.brand === '헤라'),
  },
  {
    id: 6, brand: 'SK-II', deptName: '현대백화점관', deptKey: 'hyundai',
    productName: 'PITERA 에센스 230ml', price: 178000, originalPrice: 200000, viewers: 0,
    isLive: false, thumbColor: '#1a1508',
    hostName: 'SK-II 공식 BA 오수연', hostDesc: 'PITERA 전문 스킨케어 어드바이저',
    avatarInitial: 'SK', avatarColor: '#854F0B', bgColor: '#1a1508',
    scheduledAt: '내일 오후 2:00',
    likes: 0,
    products: ALL_PRODUCTS.filter(p => p.brand === 'SK-II'),
  },
]

export const BRANDS: Brand[] = [
  {
    id: 1, name: '설화수', deptKey: 'hyundai', deptName: '현대백화점관',
    description: '한방 성분의 정수를 담은 대한민국 대표 럭셔리 뷰티 브랜드',
    categoryId: 'skincare', icon: '🌸', bgColor: '#2a1a2e', accentColor: '#993556', textColor: '#fff',
    productCount: 24,
    products: ALL_PRODUCTS.filter(p => p.brand === '설화수'),
  },
  {
    id: 2, name: '랑콤', deptKey: 'lotte', deptName: '롯데백화점관',
    description: '파리지앵 감성의 프랑스 럭셔리 뷰티, 시대를 초월한 우아함',
    categoryId: 'skincare', icon: '🌹', bgColor: '#0d1f18', accentColor: '#0F6E56', textColor: '#fff',
    productCount: 31,
    products: ALL_PRODUCTS.filter(p => p.brand === '랑콤'),
  },
  {
    id: 3, name: '라메르', deptKey: 'hyundai', deptName: '현대백화점관',
    description: '심해 미라클 브로스 테크놀로지, 최고급 스킨케어의 상징',
    categoryId: 'skincare', icon: '🌊', bgColor: '#0d1428', accentColor: '#185FA5', textColor: '#fff',
    productCount: 18,
    products: ALL_PRODUCTS.filter(p => p.brand === '라메르'),
  },
  {
    id: 4, name: '샤넬 뷰티', deptKey: 'shinsegae', deptName: '신세계백화점관',
    description: '타임리스 엘레강스, 샤넬의 아이코닉 뷰티 라인',
    categoryId: 'makeup', icon: '💎', bgColor: '#1a0a18', accentColor: '#534AB7', textColor: '#fff',
    productCount: 42,
    products: ALL_PRODUCTS.filter(p => p.brand === '샤넬 뷰티'),
  },
  {
    id: 5, name: '에스티로더', deptKey: 'lotte', deptName: '롯데백화점관',
    description: '과학과 예술의 조화, 세계 1위 안티에이징 스킨케어 브랜드',
    categoryId: 'skincare', icon: '⭐', bgColor: '#1a1208', accentColor: '#D85A30', textColor: '#fff',
    productCount: 28,
    products: ALL_PRODUCTS.filter(p => p.brand === '에스티로더'),
  },
  {
    id: 6, name: '헤라', deptKey: 'hyundai', deptName: '현대백화점관',
    description: '한국 여성의 아름다움을 재해석한 럭셔리 코스메틱',
    categoryId: 'makeup', icon: '🖤', bgColor: '#1a1a2a', accentColor: '#7F77DD', textColor: '#fff',
    productCount: 35,
    products: ALL_PRODUCTS.filter(p => p.brand === '헤라'),
  },
  {
    id: 7, name: 'SK-II', deptKey: 'hyundai', deptName: '현대백화점관',
    description: 'PITERA™ 성분의 기적, 일본 발 전설적인 스킨케어',
    categoryId: 'skincare', icon: '✨', bgColor: '#1a1508', accentColor: '#854F0B', textColor: '#fff',
    productCount: 22,
    products: ALL_PRODUCTS.filter(p => p.brand === 'SK-II'),
  },
  {
    id: 8, name: '키엘', deptKey: 'shinsegae', deptName: '신세계백화점관',
    description: '약국에서 시작된 뉴욕 헤리티지 스킨케어, 강력한 성분 중심',
    categoryId: 'skincare', icon: '🌿', bgColor: '#0a2010', accentColor: '#1D9E75', textColor: '#fff',
    productCount: 29,
    products: ALL_PRODUCTS.filter(p => p.brand === '키엘'),
  },
]

export const MOCK_CHAT: ChatMessage[] = [
  { id: 1, user: '뷰티러버', message: '피부에 너무 잘 맞아요 💕', userColor: '#993556' },
  { id: 2, user: '스킨케어queen', message: '가격이 얼마예요?', userColor: '#185FA5' },
  { id: 3, user: 'BA이지현', message: '지금 방송 중 특별가로 10% 할인 적용됩니다! 🎉', userColor: '#b8924a', isHost: true },
  { id: 4, user: '30대주부', message: '기초 라인이랑 같이 쓰면 효과 더 좋나요?', userColor: '#0F6E56' },
  { id: 5, user: '뷰티덕후', message: '작년에 이거 샀는데 재구매예요 ✨', userColor: '#534AB7' },
  { id: 6, user: 'BA이지현', message: '맞아요! 윤조 에센스 먼저 바르시고 이 크림을 사용하시면 효과가 배가돼요', userColor: '#b8924a', isHost: true },
  { id: 7, user: '새벽피부관리', message: '설화수 + 라메르 조합 어때요?', userColor: '#854F0B' },
  { id: 8, user: '입장', message: '설화수팬 님이 입장했습니다', userColor: '#9a9080', isSystem: true },
  { id: 9, user: '설화수팬', message: '와 드디어 라이브 시작했네요!', userColor: '#c4547a' },
  { id: 10, user: '50대피부고민', message: '50대도 쓸 수 있나요?', userColor: '#3C3489' },
  { id: 11, user: 'BA이지현', message: '네 물론이죠! 50대에 특히 효과적이에요. 탄력과 보습 두 가지를 동시에 잡아드려요 👍', userColor: '#b8924a', isHost: true },
]

export const MOCK_CART: CartItem[] = [
  { id: 1, productId: 1, brand: '설화수', name: '자음생 에센스 크림 60ml', price: 320000, quantity: 1, thumbIcon: '🌸', thumbColor: '#2a1a2e', deptName: '현대', deptKey: 'hyundai' },
  { id: 2, productId: 4, brand: '키엘', name: '울트라 페이셜 크림 125ml', price: 68000, quantity: 2, thumbIcon: '🌿', thumbColor: '#0d1f18', deptName: '신세계', deptKey: 'shinsegae' },
]

export const MOCK_USER: UserProfile = {
  name: '김뷰티',
  email: 'beauty@example.com',
  tier: 'VIP',
  points: 12500,
  coupons: 3,
  orders: 8,
  wishlist: 14,
}

export const CATEGORY_LABEL: Record<string, string> = {
  skincare: '스킨케어',
  makeup: '메이크업',
  perfume: '향수',
  hair: '헤어케어',
  body: '바디케어',
}

// 배송 정책 (추후 설정 화면에서 조정 가능하도록 상수로 분리)
export const SHIPPING_FEE = 3000
export const FREE_SHIPPING_THRESHOLD = 50000
export const SHIPPING_NOTICE = '배송비 3,000원 · 50,000원 이상 무료'
