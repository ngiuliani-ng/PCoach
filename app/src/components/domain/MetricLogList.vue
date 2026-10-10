<script setup lang="ts">
// Componente generico per gli storici datati (soglie corsa/bici/nuoto, carico).
// Riusato per le tre discipline invece di tre componenti quasi identici.
import { formatDate, todayISO } from "../../constants";
import type { MetricFieldDef } from "../../constants";
import { SOURCE_OPTIONS } from "../../constants";
import IconButton from "../ui/IconButton.vue";
import { Plus, Trash2 } from "lucide-vue-next";

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
    <p v-if="!modelValue.length" class="helper-text">Nessuna rilevazione.</p>
    <div v-for="(row, index) in modelValue" :key="index" class="unit">
      <div class="unit-head">
        <span class="unit-title">{{ row.date ? `Rilevazione del ${formatDate(row.date)}` : "Rilevazione senza data" }}</span>
        <IconButton :label="`Rimuovi rilevazione del ${formatDate(row.date) || 'giorno non indicato'}`" @click="removeRow(index)">
          <Trash2 :size="16" aria-hidden="true" />
        </IconButton>
      </div>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Data</span>
          <input type="date" :value="row.date" @change="setField(index, 'date', ($event.target as HTMLInputElement).value)" />
        </label>
        <label class="field">
          <span class="field-label">Fonte</span>
          <select :value="row.source" @change="setField(index, 'source', ($event.target as HTMLSelectElement).value)">
            <option v-for="[v, l] in SOURCE_OPTIONS" :key="v" :value="v">{{ l }}</option>
          </select>
        </label>
        <label v-for="f in fieldDefs" :key="f.key" class="field">
          <span class="field-label">{{ f.label }}</span>
          <input
            v-if="f.type !== 'select'"
            :type="f.type"
            :value="row[f.key] ?? ''"
            @change="setField(index, f.key, f.type === 'number' ? ($event.target as HTMLInputElement).valueAsNumber || null : ($event.target as HTMLInputElement).value)"
          />
          <select v-else :value="row[f.key] ?? ''" @change="setField(index, f.key, ($event.target as HTMLSelectElement).value)">
            <option value=""></option>
            <option v-for="[v, l] in f.options" :key="v" :value="v">{{ l }}</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span class="field-label">Nota</span>
        <input type="text" :value="row.note ?? ''" @change="setField(index, 'note', ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
    <button type="button" class="add-row" @click="addRow"><Plus :size="16" aria-hidden="true" />Aggiungi rilevazione</button>
  </div>
</template>
