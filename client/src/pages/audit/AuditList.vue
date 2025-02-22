<template>
    <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
      <Toolbar title="Logbuch" icon="history" search :searchText.sync="search">
        <template #right>
          <v-select
          class="mt-6 max-w-200"
          :items="durations"
          item-text="label"
          item-value="value"
          v-model="duration">
        </v-select>
      </template>
    </Toolbar>
      </Toolbar>
      <v-divider />
      <v-card-text style="height:100%;overflow: hidden;">
        <AuditTable
          v-if="loaded"
          :records="records"
          :duration="duration"
          :search="search"
          @onRowClicked="onRowClicked"
          @onGridReady="onGridReadyHandler"
        />
        <AuditRecordDetails ref="recordDetails"/>
      </v-card-text>
    </v-card>
  </template>
  
  <script>
  
  import axios from 'axios'
  import router from '@/router'
  import AuditTable from '@/components/audit/AuditTable'
  import AuditRecordDetails from '@/components/audit/AuditRecordDetails.vue'
  import Toolbar from '@/components/layout/Toolbar'
  import ToolbarButton from '@/components/layout/ToolbarButton'
  
  export default {
    components: { AuditTable, AuditRecordDetails, Toolbar, ToolbarButton },
    data() {
      return {
        records: [],
        loaded: false,
        loading: false,
        search: '',
        gridApi: null,
        durations: [
          { label: 'Letzte 7 Tage', value: 1000 * 60 * 60 * 24 * 7 },
          { label: 'Letzte 30 Tage', value: 1000 * 60 * 60 * 24 * 30 },
          { label: 'Letzte 90 Tage', value: 1000 * 60 * 60 * 24 * 90 },
          { label: 'Letzte 365 Tage', value: 1000 * 60 * 60 * 24 * 365 },
          { label: 'Alle', value: 0 }
        ],
        duration: 1000 * 60 * 60 * 24 * 7
      }
    },
    watch: {
        duration: function() {
            this.getData();
        }
    },
    methods: {
      onGridReadyHandler(params) {
        this.gridApi = params.api;
      },
      onRowClicked: async function(row) {
        console.log(row, row.oldValue)
        await this.$refs.recordDetails.open(row.text,row.oldValue, row.newValue)        
      },
      getData: function () {
        axios.get('/api/audit?duration=' + this.duration) 
          .then(response => {
            this.records = response.data.records;
            this.loaded = true;
          })
          .catch(e => {});
      }
    },
    async created() {
      this.getData();
    }
  }
  </script>