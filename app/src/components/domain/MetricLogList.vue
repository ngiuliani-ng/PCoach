<script setup lang="ts">
// Componente generico per gli storici datati (soglie corsa/bici/nuoto, carico).
// Riusato per le tre discipline invece di tre componenti quasi identici.
import { todayISO } from "../../constants";
import type { MetricFieldDef } from "../../constants";
import { SOURCE_OPTIONS } from "../../constants";

type LogEntry = Record<string, unknown> & { date: string; source: string; note?: string };

const props = defineProps<{
  modelValue: LogEntry[];
  fieldDefs: MetricFieldDef[];
}>();
const emit = defineEmits<{ (e: "update:modelValue", value: LogEntry[]): void }>();

function update(mutator: (rows: LogEntry[]) => void) {
  const rows = props.modelValue.map((r) => ({ ...r }));
  mutator(rows);
  emit("update:modelValue", rows);
}

function addRow() {
  update((rows) => {
    rows.push({ date: todayISO(), source: "manual", note: "" });
  });
}

function removeRow(index: number) {
  update((rows) => {
    rows.splice(index, 1);
  });
}

function setField(index: number, key: string, value: unknown) {
  update((rows) => {
    (rows[index] as Record<string, unknown>)[key] = value;
  });
}
</script>

<template>
  <div>
    <div v-for="(row, index) in modelValue" :key="index" class="discipline-card">
      <div class="discipline-card-head">
        <span>Rilevazione {{ index + 1 }}</span>
        <button type="button" class="icon-btn" @click="removeRow(index)">Rimuovi</button>
      </div>
      <div class="field-row">
        <div>
          <label>Data</label>
          <input type="date" :value="row.date" @change="setField(index, 'date', ($event.target as HTMLInputElement).value)" />
        </div>
        <div>
          <label>Fonte</label>
          <select :value="row.source" @change="setField(index, 'source', ($event.target as HTMLSelectElement).value)">
            <option v-for="[v, l] in SOURCE_OPTIONS" :key="v" :value="v">{{ l }}</option>
          </select>
        </div>
        <template v-for="f in fieldDefs" :key="f.key">
          <div>
            <label>{{ f.label }}</label>
            <input
              v-if="f.type !== 'select'"
              :type="f.type"
              :class="{ 'mono-input': f.mono }"
              :value="row[f.key] ?? ''"
              @change="setField(index, f.key, f.type === 'number' ? ($event.target as HTMLInputElement).valueAsNumber || null : ($event.target as HTMLInputElement).value)"
            />
            <select v-else :value="row[f.key] ?? ''" @change="setField(index, f.key, ($event.target as HTMLSelectElement).value)">
              <option value=""></option>
              <option v-for="[v, l] in f.options" :key="v" :value="v">{{ l }}</option>
            </select>
          </div>
        </template>
      </div>
      <div class="field-row">
        <div style="grid-column: 1 / -1">
          <label>Nota</label>
          <input type="text" :value="row.note ?? ''" @change="setField(index, 'note', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>
    </div>
    <button type="button" class="add-row" @click="addRow">+ Aggiungi rilevazione</button>
  </div>
</template>
