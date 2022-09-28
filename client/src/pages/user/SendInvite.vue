<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" min-height="700">
    <Toolbar title="Einladung senden" back >
      <template #right>
        <ToolbarButton
          icon="send"
          tooltip="Einladung senden"
          color="success"
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
            @selectGroup="onSelectGroup"
            @onGridReady="params => gridApi.groups = params.api"
            @onDataRendered="selectGroups"
            rowSelection="multiple"
            heightOffset="30"/>
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
      valid: false,
      groups: [],
      loaded: false,
      email: '',
      search: '',
      memberGroups: [],
      gridApi: {
        groups: null
      }
    }
  },
  methods: {
    onSelectGroup: function(group, selected) {
      if (selected && !this.memberGroups.find(g => g.dn === group.dn)) {
        this.memberGroups.push(group);
      } else if (!selected) {
        var index = this.memberGroups.findIndex(g => g.dn === group.dn)
        if (index >= 0) {
          this.memberGroups.splice(index, 1);
        }
      }
    },
    selectGroups() {
      this.gridApi.groups.forEachNode(rowNode => {
        if (this.memberGroups.find(p => p.dn === rowNode.data.dn)) {
          if (!rowNode.isSelected()) {
            rowNode.setSelected(true);
          }
        } else {
          if (rowNode.isSelected()) {
            rowNode.setSelected(false);
          }
        }
      })
    },
    save: function () {
      var self = this;
      axios.post('/api/user/invite', {email: this.email, groups: this.memberGroups.map(g => g.dn)})
        .then(response => {
          this.$snackbar.success('Einladung an ' + self.email + ' verschickt')
          router.push('/invites')
        })
        .catch(error => {
          console.log('error', error);
        })
    },
    getGroups: function () {
      axios.get('/api/groups')
        .then(response => {
          this.groups = response.data.groups;
          this.loaded = true;
        });
    }
  },
  created() {
    this.getGroups();
  }
}
</script>