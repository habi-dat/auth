<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" min-height="700" elevation=5>
    <Toolbar title="Einladung senden" back >
      <template #right>
        <ToolbarButton
          icon="send"
          tooltip="Einladung senden"
          color="success"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <v-row style="height: 100%;">
        <v-col sm="12" md="4">
          <v-form
            ref="form"
            v-model="valid"
            lazy-validation>
            <EmailField
              v-model="email"
              checkAvailability
            />
            <MemberField
              icon="groups"
              label="Mitglied in"
              v-model="memberGroups"
              @input="selectGroups"
              itemText="o"
              itemValue="dn"
              tooltip="group"
              close
            />
            <MemberField
              icon="groups"
              label="Admin von"
              v-model="ownerGroups"
              @input="selectGroups"
              itemText="o"
              itemValue="dn"
              tooltip="group"
              close
            />
          </v-form>
        </v-col>
        <v-divider vertical />
        <v-col md="" sm="12" minHeight="400" style="height: 100%; min-height: 400px; overflow: hidden;">
          <Toolbar title="Gruppenauswahl" icon="groups" search searchPosition="right" :searchText.sync="search"/>
          <GroupTable
            v-if="loaded"
            :groups="groups"
            :search="search"
            :flat="!$store.state.user.isAdmin"
            :selectCellItems="selectCellItems"
            @selectGroup="onSelectGroup"
            @onGridReady="params => gridApi.groups = params.api"
            @onDataRendered="selectGroups"
            rowSelection="multiple"
            :heightOffset="30"
            comboSelect/>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import GroupTable from '@/components/group/GroupTable'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
import EmailField from '@/components/form/EmailField'
import MemberField from '@/components/form/MemberField'

export default {
  components: { GroupTable, Toolbar, ToolbarButton, EmailField, MemberField },
  data() {
    return {
      loading: false,
      valid: false,
      groups: [],
      loaded: false,
      email: '',
      search: '',
      memberGroups: [],
      ownerGroups: [],
      gridApi: {
        groups: null
      },
      selectCellItems: [
          { value: 'none', icon: 'check_box_outline_blank', text: 'Kein Mitglied', color:'black'},
          { value: 'member', icon: 'portrait', text:'Mitglied', selected: true, color: 'info'},
          { value: 'owner', icon: 'edit', text: 'Admin', selected: true, color: 'success'}
        ],
    }
  },
  methods: {
    onSelectGroup: function(group, selectCell) {

      // little helpers
      const pushIfNotExists = (list, group) => {
        if (!list.find(l => l.dn === group.dn)) {
          list.push(group);
        }
      }
      const deleteIfExists = (list, dn, listPopulated) => {
        if (list.find(l => l.dn === group.dn)) {
          list.splice(list.findIndex(l => l.dn === group.dn), 1);
        }
      }

      if (selectCell.value === 'owner') {
        pushIfNotExists(this.memberGroups, group);
        pushIfNotExists(this.ownerGroups, group);
      } else if (selectCell.value === 'member') {
        pushIfNotExists(this.memberGroups, group);
        deleteIfExists(this.ownerGroups, group)
      } else {
        deleteIfExists(this.memberGroups, group);
        deleteIfExists(this.ownerGroups, group);
      }
    },
    selectGroups() {
      this.gridApi.groups.forEachNode(rowNode => {
        var selectCell;
        if (this.ownerGroups.find(o => o.dn === rowNode.data.dn)) {
          if (this.memberGroups.find(m => m.dn === rowNode.data.dn)) {
            selectCell = this.selectCellItems[2]
          } else {
            this.ownerGroups.splice(this.ownerGroups.findIndex(o => o.dn === rowNode.data.dn), 1)
            selectCell = this.selectCellItems[0]
          }
        } else if (this.memberGroups.find(m => m.dn === rowNode.data.dn)) {
          selectCell = this.selectCellItems[1]
        } else {
          selectCell = this.selectCellItems[0]
        }
        if (selectCell && selectCell !== rowNode.data.selectCell) {
          rowNode.data.selectCell = selectCell;
          rowNode.setData(rowNode.data);
        }
      });
    },
    save: function () {
      var self = this;
      this.loading = true;
      axios.post('/api/user/invite', {email: this.email, member: this.memberGroups.map(g => g.dn), owner: this.ownerGroups.map(g => g.dn)})
        .then(response => {
          this.$snackbar.success('Einladung an ' + self.email + ' verschickt')
          this.loading = false;
          router.push('/invites')
        })
        .catch(error => {
          this.loading = false;
        })
    },
    getGroups: function () {
      axios.get('/api/groups')
        .then(response => {
          this.groups = response.data.groups;
          this.loaded = true;
        })
        .catch(e => {});
    }
  },
  created() {
    this.getGroups();
  }
}
</script>