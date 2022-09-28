<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Gruppen" icon="groups" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="edit"
          tooltip="Gruppe bearbeiten"
          color="info"
          @click="updateGroup"
          :disabled="selectedGroups.length === 0"
        />
        <ToolbarButton
          icon="delete"
          tooltip="Gruppe löschen"
          color="error"
          @click="deleteGroup"
          :disabled="selectedGroups.length === 0"
        />
        <ToolbarButton
          icon="add"
          tooltip="Gruppe erstellen"
          color="success"
          to="/group/create"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height:100%;overflow: hidden;">
      <GroupTable
        v-if="groupsLoaded"
        :groups="groups"
        :search="search"
        @selectionChanged="onSelectGroup"
        @onGridReady="onGridReadyHandler"
        showMembers="true"
        rowSelection="single"/>
    </v-card-text>
    <ConfirmDialog ref="confirm" />
  </v-card>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import GroupTable from '@/components/group/GroupTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { GroupTable, ConfirmDialog, Toolbar, ToolbarButton },
  data() {
    return {
      groups: [],
      selectedGroups: [],
      groupsLoaded: false,
      search: '',
      gridApi: null
    }
  },
  methods: {
    onGridReadyHandler(params) {
        this.gridApi = params.api;
    },
    onSelectGroup: function(selectedRows) {
      this.selectedGroups = selectedRows;
    },
    async deleteGroup() {
      var group = this.selectedGroups[0];
      if (await this.$refs.confirm.open('Bist du sicher?','Willst du die Gruppe ' + group.cn + ' wirklich löschen?')) {
        axios.delete('/api/group/' + group.dn)
          .then(response => {
            if (response.data.status === 'success') {
              this.$snackbar.success(response.data.message)
            } else {
              this.$snackbar.warning(response.data.message)
            }
            this.gridApi.applyTransaction({ remove: [group]});
          })
      }
    },
    updateGroup() {
      router.push('/group/update?dn=' + this.selectedGroups[0].dn)
    },
    getGroups: function () {
      var self = this;
      axios.get('/api/groups')
        .then(response => {
          self.groups = response.data.groups;
          self.groupsLoaded = true;
        });
    }
  },
  async created() {
    this.getGroups();
  }
}
</script>