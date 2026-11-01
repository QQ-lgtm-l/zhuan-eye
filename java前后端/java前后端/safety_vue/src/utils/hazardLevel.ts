export const HAZARD_LEVELS = ['Ⅰ级重大', 'Ⅱ级较大', 'Ⅲ级一般', 'Ⅳ级轻微'] as const;
export type HazardLevel = (typeof HAZARD_LEVELS)[number];

export function normalizeLevel(raw?: string | null): HazardLevel {
	const text = String(raw || '').trim();
	if ((HAZARD_LEVELS as readonly string[]).includes(text)) return text as HazardLevel;
	if (text.includes('重大') || text.includes('Ⅰ')) return 'Ⅰ级重大';
	if (text.includes('较大') || text.includes('Ⅱ')) return 'Ⅱ级较大';
	if (text.includes('轻微') || text.includes('Ⅳ')) return 'Ⅳ级轻微';
	return 'Ⅲ级一般';
}

export function levelTagType(raw?: string | null): 'danger' | 'warning' | 'primary' | 'info' {
	const level = normalizeLevel(raw);
	if (level === 'Ⅰ级重大') return 'danger';
	if (level === 'Ⅱ级较大') return 'warning';
	if (level === 'Ⅲ级一般') return 'primary';
	return 'info';
}

export function levelColor(raw?: string | null): string {
	const level = normalizeLevel(raw);
	if (level === 'Ⅰ级重大') return '#D32F2F';
	if (level === 'Ⅱ级较大') return '#E6A23C';
	if (level === 'Ⅲ级一般') return '#409EFF';
	return '#909399';
}

export function levelShort(raw?: string | null): string {
	return normalizeLevel(raw).replace('级', '').slice(0, 1);
}

export function levelOptions() {
	return HAZARD_LEVELS.map((level) => ({ label: level, value: level }));
}

export function responseTimeout(raw?: string | null): string {
	const level = normalizeLevel(raw);
	if (level === 'Ⅰ级重大') return '0.5小时';
	if (level === 'Ⅱ级较大') return '4小时';
	return '24小时';
}

export function rectifyTimeout(raw?: string | null): string {
	const level = normalizeLevel(raw);
	if (level === 'Ⅰ级重大') return '24小时';
	if (level === 'Ⅱ级较大') return '48小时';
	if (level === 'Ⅲ级一般') return '7天';
	return '3天';
}
