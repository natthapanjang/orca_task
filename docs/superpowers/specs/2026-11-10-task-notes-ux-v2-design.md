# task-notes UX v2: design spec

Authority for the v2 plan. Builds on `2026-11-10-task-notes-design.md` (data, repo default) and the field/filter work already merged on `feat/task-fields-filter`.

## Goal
Make the 320px sidebar panel fast to capture into and easy to scan, and close the gaps left by v1: tasks can be edited after adding, tasks without a repo can be filtered, due dates show urgency, the list is ordered.

## Design basis (ui-ux-pro-max)
- Style: minimal, dense, functional (Swiss-style dashboard row). Density high, motion none, variance low.
- No custom palette or fonts: Orca components follow Orca's theme (light and dark). Tones only through `Badge tone` (`neutral`, `warning`, `danger` if offered, else `warning`).
- Rules applied: error shown next to its field (not only at top); urgency never by color alone (text + tone); labels visible or `labelHidden` with an accessible label; icon buttons carry the task title in their label; validate on blur/submit, clear on typing.

## Layout, top to bottom
1. **Quick add**: one Input `งานใหม่` (Enter adds) + button `เพิ่ม`. Always visible. Task goes in with defaults: repo of the focused worktree, status `todo`, no due date, no description.
2. **รายละเอียดเพิ่มเติม** toggle (ghost Button): reveals Textarea `รายละเอียด`, Input `วันครบกำหนด` (placeholder `YYYY-MM-DD`), Select `repo`, Select `สถานะ`. Collapsed by default; stays open after add only if the user opened it. Invalid due date: Field error `วันที่ต้องเป็น YYYY-MM-DD`, blocks add, opens the section.
3. **Filter bar** (one Row, wraps): Select `กรองสถานะ` (`ทั้งหมด` + 4 statuses), Select `กรองตามที่เก็บ` (`ทุก repo`, `ไม่ระบุ repo`, each repo). Active filter shows in the footer text.
4. **Tabs**: `ทั้งหมด` / `worktree นี้` (unchanged).
5. **List** (ordered, see below).
6. **Footer**: `เหลือ N งาน` + `ล้างที่เสร็จแล้ว` (acts on visible tasks only).

## Row
Read mode, three lines max:
- Line 1: Checkbox (label = title). Ticking sets `completed`; unticking sets `todo`.
- Line 2 (only if present): description, muted, small, clamped to the text the component gives (no custom truncation).
- Line 3: Row of Badges and actions: `repo` (neutral; `ไม่ระบุ repo` warning when empty), due badge, status Select, edit IconButton (`แก้ไข: <title>`), delete IconButton (`ลบ: <title>`).

Due badge copy and tone (due vs local today, ignored when `completed`):
| Condition | Text | Tone |
|---|---|---|
| overdue | `เลยกำหนด N วัน` | warning |
| today | `ครบวันนี้` | warning |
| 1–2 days | `ครบอีก N วัน` | neutral |
| later | the date `YYYY-MM-DD` | neutral |
| completed | the date | neutral |

Edit mode (replaces the row, one row at a time): Input title, Textarea description, Input due (inline error), Select repo (or typed Input when no repo is known), Select status, buttons `บันทึก` / `ยกเลิก`. Enter in title saves; blank title shows `พิมพ์ข้อความงานก่อน` and keeps the row open. The existing repo-only edit is folded into this.

## Order
Within the filtered list: unfinished before `completed`; then by `dueDate` ascending with no-due last; then oldest `at` first. Pure function, unit-tested.

## States
- No tasks at all: EmptyState `ยังไม่มีงาน`.
- Filter hides everything: EmptyState `ไม่มีงานตรงตัวกรอง`, description `เปลี่ยนตัวกรองด้านบนเป็น “ทั้งหมด”`.
- Repo filter value that no longer exists falls back to all (already built).
- Corrupt storage: empty list, nothing written back (already built).

## Out of scope
Persisting filter choice across reloads, drag-to-reorder, a calendar date picker (no such component), changing the storage shape, new capabilities.

## Open points
- Whether Orca's `Badge` offers a `danger` tone; if not, `warning` is used for both overdue and today.
- The `no repo` filter value must not collide with a real repo name: use a sentinel the options list cannot contain.
