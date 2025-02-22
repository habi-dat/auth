<template>
  <v-dialog
    v-model="dialog"
    :max-width="options.width"
    :style="{ zIndex: options.zIndex }"
    @keydown.esc="cancel"
  >
    <v-card>
      <v-toolbar dark :color="options.color" dense flat>
        <v-toolbar-title class="text-body-2 font-weight-bold grey--text">
          {{ title }}
        </v-toolbar-title>
      </v-toolbar>
      <v-card-text>
        <v-row>
          <v-col sm="6">
            <h4 class="my-2 text-heading-4">Alte Werte:</h4>
            <p class="my-1" v-for="line in oldLines" :key="line">
              <span v-if="!Array.isArray(line.value)"><span class="font-weight-bold">{{ line.key }}:</span> {{ line.value }}</span>
              <span v-else><span class="font-weight-bold">{{ line.key }}:</span> <ul><li v-for="item in line.value">{{ item }}</li></ul></span>
            </p>
          </v-col>
          <v-col sm="6">
            <h4 class="my-2 text-heading-4">Neue Werte:</h4>
            <p class="my-1" v-for="line in newLines" :key="line">
              <span v-if="!Array.isArray(line.value)"><span class="font-weight-bold">{{ line.key }}:</span> {{ line.value }}</span>
              <span v-else><span class="font-weight-bold">{{ line.key }}:</span> <ul><li v-for="item in line.value">{{ item }}</li></ul></span>
            </p>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="pt-3">
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          class="body-2 font-weight-bold"
          @click.native="close"
          >Schließen</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
  export default {
    name: "AuditRecordDetails",
    data() {
      return {
        dialog: false,
        resolve: null,
        reject: null,
        oldLines: null,
        newLines: null,
        title: null,
        options: {
          color: "grey lighten-3",
          width: 800,
          zIndex: 200,
          noconfirm: false,
        },
      };
    },

    methods: {
      open(title, oldValue, newValue, options) {
        this.dialog = true;
        this.title = title;
        this.oldLines = Object.keys(oldValue).toSorted().map(key => ({ key, value: oldValue[key] })).filter(line => Array.isArray(line.value) && line.value.length > 0 || !Array.isArray(line.value) && line.value && line.value !== '');
        this.newLines = Object.keys(newValue).toSorted().map(key => ({ key, value: newValue[key] })).filter(line => Array.isArray(line.value) && line.value.length > 0 || !Array.isArray(line.value) && line.value && line.value !== '');
        this.options = Object.assign(this.options, options);
      },
      close() {
        this.dialog = false;
      },
    },
  };
</script>
