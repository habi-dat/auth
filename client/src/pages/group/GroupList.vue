<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
    <Toolbar title="Gruppen" icon="groups" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="visibility"
          tooltip="Gruppe öffnen"
          color="success"
          @click="openGroup"
          :disabled="selectedGroups.length === 0 || !$store.state.user.isAdmin && !selectedGroups[0].member.includes($store.state.user.dn)"
        />        
        <ToolbarButton
          v-if="$store.state.user.isAdmin || $store.state.user.isGroupAdmin"
          icon="edit"
          tooltip="Gruppe bearbeiten"
          color="info"
          @click="updateGroup"
          :disabled="selectedGroups.length === 0 || !$store.state.user.isAdmin && !selectedGroups[0].owner.includes($store.state.user.dn)"
        />
        <ToolbarButton
          v-if="$store.state.user.isAdmin"
          icon="delete"
          tooltip="Gruppe löschen"
          color="error"
          :loading="loading"
          @click="deleteGroup"
          :disabled="selectedGroups.length === 0"
        />
        <ToolbarButton
          v-if="$store.state.user.isAdmin"
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
        showMembers
        rowSelection="single"
        selection="member"/>
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
      loading: false,
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
      this.loading = true;
      var group = this.selectedGroups[0];
      if (await this.$refs.confirm.open('Bist du sicher?','Willst du die Gruppe ' + group.cn + ' wirklich löschen?')) {
        axios.delete('/api/group/' + group.dn)
          .then(response => {
            this.loading = false;
            if (response.data.status === 'success') {
              this.$snackbar.success(response.data.message)
            } else {
              this.$snackbar.warning(response.data.message)
            }
            this.gridApi.applyTransaction({ remove: [group]});
          })
          .catch(e => { this.loading = false; })
      }
    },
    updateGroup() {
      router.push('/group/update?dn=' + this.selectedGroups[0].dn)
    },
    openGroup() {
      router.push('/group/open?dn=' + this.selectedGroups[0].dn)
    },
    getGroups: function () {
      var self = this;
      axios.get('/api/groups')
        .then(response => {
          self.groups = response.data.groups;
          self.groupsLoaded = true;
        })
        .catch(e => {});
    }
  },
  async created() {
    this.getGroups();
  }
}
</script>