<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Apps" icon="category" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="edit"
          tooltip="App bearbeiten"
          color="info"
          @click="updateApp"
          :disabled="selectedApps.length === 0"
        />
        <ToolbarButton
          icon="delete"
          tooltip="App löschen"
          color="error"
          @click="deleteApp"
          :disabled="selectedApps.length === 0"
        />
        <ToolbarButton
          icon="add"
          tooltip="App erstellen"
          color="success"
          to="/app/create"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height:100%;overflow: hidden;">
      <AppTable
        v-if="loaded"
        :apps="apps"
        :search="search"
        @selectionChanged="onSelectionChanged"
        @onGridReady="onGridReadyHandler"
      />
    </v-card-text>
    <ConfirmDialog ref="confirm" />
  </v-card>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import AppTable from '@/components/app/AppTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { AppTable, ConfirmDialog, Toolbar, ToolbarButton },
  data() {
    return {
      apps: [],
      selectedApps: [],
      loaded: false,
      search: '',
      gridApi: null
    }
  },
  methods: {
    onGridReadyHandler(params) {
      this.gridApi = params.api;
    },
    onSelectionChanged: function(selectedRows) {
      this.selectedApps = selectedRows;
    },
    async deleteApp() {
      var app = this.selectedApps[0];
      if (await this.$refs.confirm.open('Bist du sicher?','Willst du die Kategorie ' + app.id + ' wirklich löschen?')) {
        axios.delete('/api/app/' + app.id)
          .then(response => {
            if (response.data.status === 'success') {
              this.$snackbar.success('Kategorie ' + app.id + ' gelöscht')
              this.gridApi.applyTransaction({ remove: [app]});
            }
          })
      }
    },
    updateApp() {
      router.push('/app/update?id=' + this.selectedApps[0].id)
    },
    getData: function () {
      axios.get('/api/apps')
        .then(response => {
          this.apps = response.data.apps;
          this.loaded = true;
        });
    }
  },
  async created() {
    this.getData();
  }
}
</script>