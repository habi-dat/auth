<template>
  <v-row style="height: 100%;">
    <v-col sm="12" md="4">

      <v-form
        ref="form"
        v-model="valid">
        <v-text-field
          prepend-icon="label"
          v-model="group.o"
          :rules="[v => /^.{3,}$/.test(v) || 'mindestens 3 Zeichen']"
          label="Anzeigenname"
          @input="updateCn"
          :readonly="action==='openGroup'"
          required>
        </v-text-field>
        <v-text-field
          prepend-icon="groups"
          :disabled="!$store.state.user.isAdmin || action ==='updateGroup' && oldGroup.cn === 'admin'"
          v-model="group.cn"
          :rules="[v => /^[A-Za-z0-9_-]{2,}[A-Za-z0-9]+$/.test(v) || 'mindestens 3 Zeichen, keine Sonderzeichen, keine Umlaute, keine Leerzeichen']"
          :error-messages="errors.cn"
          @change="checkCnAvailability"
          label="Gruppen ID"
          required>
        </v-text-field>
        <v-textarea
          prepend-icon="description"
          v-model="group.description"
          :rules="[v => !!v || 'Beschreibung darf nicht leer sein' ]"
          label="Beschreibung"
          required>
        </v-textarea>
        <MemberField
          v-if="showMembers"
          icon="group"
          label="Mitglieder"
          v-model="group.member"
          @input="selectUsers"
          itemText="cn"
          itemValue="dn"
          tooltip="user"
          close
          :readonly="action==='openGroup'"
        />
        <MemberField
          v-if="showMembers"
          icon="edit"
          label="Admin@s"
          v-model="group.owner"
          @input="selectUsers"
          itemText="cn"
          itemValue="dn"
          tooltip="user"
          close
          :readonly="action==='openGroup'"          
        />
        <MemberField
          v-if="showParentgroups"
          icon="expand_less"
          label="Übergruppen"
          v-model="group.parentGroups"
          @input="selectParentGroups"
          itemText="o"
          itemValue="dn"
          tooltip="group"
          close
          :readonly="action==='openGroup'"          
        />
        <MemberField
          v-if="showSubgroups"
          icon="expand_more"
          label="Untergruppen"
          v-model="group.subGroups"
          @input="selectSubGroups"
          itemText="o"
          itemValue="dn"
          tooltip="group"
          close
          :readonly="action==='openGroup'"          
        />
      </v-form>

    </v-col>
    <v-divider vertical />
    <v-col md="" sm="12" minHeight="400" style="height: 100%; min-height: 400px; overflow: hidden;">
      <Toolbar>
        <template #left>
          <v-tabs
            v-model="tab"
            left
            icons-and-text>
            <v-tabs-slider></v-tabs-slider>
            <v-tab href="#tab-member" v-if="showMembers">
              Mitglieder
              <v-icon>group</v-icon>
            </v-tab>
            <v-tab href="#tab-parentgroups" v-if="showParentgroups">
              Übergruppen
              <v-icon>expand_less</v-icon>
            </v-tab>
            <v-tab href="#tab-subgroups" v-if="showSubgroups">
              Untergruppen
              <v-icon>expand_more</v-icon>
            </v-tab>
          </v-tabs>
        </template>
        <template #right>
          <ToolbarSearch v-if="tab === 'tab-member'" :search.sync="searchUsers"/>
          <ToolbarSearch v-if="tab === 'tab-parentgroups'" :search.sync="searchParentGroups"/>
          <ToolbarSearch v-if="tab === 'tab-subgroups'" :search.sync="searchGroups"/>
        </template>
      </Toolbar>
      <v-tabs-items v-model="tab" style="height: 100%; min-height: 400px; overflow: hidden;">
        <v-tab-item key="1" value="tab-member" style="height: 100%; min-height: 400px; overflow: hidden;">
          <UserTable
            v-if="loaded"
            :users="users"
            :search="searchUsers"
            @selectUser="onSelectUser"
            @onGridReady="params => gridApi.users = params.api"
            @onDataRendered="selectUsers"
            comboSelect
            :selectCellItems="selectCellItems"
            rowSelection="multiple"
            :heightOffset="30"
            :readonly="action==='openGroup'"  />
        </v-tab-item>
        <v-tab-item key="2" value="tab-parentgroups" style="height: 100%; min-height: 400px; overflow: hidden;">
          <GroupTable
            v-if="loaded"
            :groups="groups"
            :search="searchParentGroups"
            :flat="!$store.state.user.isAdmin"
            @selectGroup="onSelectParentGroup"
            @onGridReady="params => gridApi.parentGroups = params.api"
            @onDataRendered="selectParentGroups"
            rowSelection="multiple"
            :heightOffset="30" />
        </v-tab-item>
        <v-tab-item key="3" value="tab-subgroups" style="height: 100%; min-height: 400px; overflow: hidden;">
          <GroupTable
            v-if="loaded"
            :groups="groups"
            :search="searchGroups"
            :flat="!$store.state.user.isAdmin"
            @selectGroup="onSelectGroup"
            @onGridReady="params => gridApi.subGroups = params.api"
            @onDataRendered="selectSubGroups"
            rowSelection="multiple"
            :heightOffset="30" />
        </v-tab-item>
      </v-tabs-items>
    </v-col>
  </v-row>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import GroupTable from '@/components/group/GroupTable'
import UserTable from '@/components/user/UserTable'
import MemberField from '@/components/form/MemberField'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
import ToolbarSearch from '@/components/layout/ToolbarSearch'

export default {
  name: 'GroupForm',
  components: { GroupTable, UserTable, MemberField, ToolbarButton, Toolbar, ToolbarSearch },
  props: ['action', 'group', 'showMembers', 'showSubgroups', 'showParentgroups'],
  data() {
    return {
      errors: {
        cn: []
      },
      gridApi: {
        users: null,
        subGoups: null,
        parentGroups: null
      },
      valid: true,
      oldGroup: {},
      searchUsers: '',
      searchGroups: '',
      searchParentGroups: '',
      tab: null,
      loaded: false,
      selectCellItems: [
          { value: 'none', icon: 'check_box_outline_blank', text: 'Kein Mitglied', color:'black'},
          { value: 'member', icon: 'portrait', text:'Mitglied', selected: true, color: 'info'},
          { value: 'owner', icon: 'edit', text: 'Admin', selected: true, color: 'success'}
        ]
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue);
    }
  },
  methods: {
    onSelectUser: function(user, selectCell) {
      // little helpers
      const pushIfNotExists = (list, user) => {
        if (!list.find(element => element.dn === user.dn)) {
          list.push(user);
        }
      }
      const deleteIfExists = (list, user) => {
        var index = list.findIndex(element => element.dn === user.dn)
        if (index >= 0) {
          list.splice(index, 1);
        }
      }
      if (selectCell.value === 'owner') {
        pushIfNotExists(this.group.member, user);
        pushIfNotExists(this.group.owner, user);
      } else if (selectCell.value === 'member') {
        pushIfNotExists(this.group.member, user);
        deleteIfExists(this.group.owner, user)
      } else {
        deleteIfExists(this.group.member, user);
        deleteIfExists(this.group.owner, user);
      }
    },
    selectUsers() {
      this.gridApi.users.forEachNode(rowNode => {
        var selectCell;
        if (this.group.owner.find(o => o.dn === rowNode.data.dn)) {
          if (this.group.member.find(m => m.dn === rowNode.data.dn)) {
            selectCell = this.selectCellItems[2]
          } else {
            this.group.owner.splice(this.group.owner.findIndex(o => o.dn === rowNode.data.dn), 1)
            selectCell = this.selectCellItems[0]
          }
        } else if (this.group.member.find(m => m.dn === rowNode.data.dn)) {
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
    selectParentGroups() {
      this.gridApi.parentGroups.forEachNode(rowNode => {
        if (this.group.parentGroups.find(p => p.dn === rowNode.data.dn)) {
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
    selectSubGroups() {
      this.gridApi.subGroups.forEachNode(rowNode => {
        if (this.group.subGroups.find(p => p.dn === rowNode.data.dn)) {
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
    onSelectGroup: function(group, selected) {
      if (selected && !this.group.subGroups.find(g => g.dn === group.dn)) {
        this.group.subGroups.push(group);
        console.log(group);
      } else if (!selected) {
        var index = this.group.subGroups.findIndex(g => g.dn === group.dn)
        if (index >= 0) {
          this.group.subGroups.splice(index, 1);
        }
      }
    },
    onSelectParentGroup: function(group, selected) {
      if (selected && !this.group.parentGroups.find(g => g.dn === group.dn)) {
        this.group.parentGroups.push(group);
      } else if (!selected) {
        var index = this.group.parentGroups.findIndex(g => g.dn === group.dn)
        if (index >= 0) {
          this.group.parentGroups.splice(index, 1);
        }
      }
    },
    async checkCnAvailability (cn) {
      this.errors.cn = []
      if (cn !== this.oldGroup.cn) {
        try {
          await axios.get('/api/group/available/cn/' + cn)
            .then(response => {
              if(!response.data.available) {
                this.errors.cn.push('Gruppen ID ist leider bereits vergeben')
              }
            })
        } catch(error) {}
      }
    },
    updateCn(newO) {
      if (this.action === 'createGroup') {
        this.group.cn = newO.toLowerCase()
              .replaceAll('ä', 'ae')
              .replaceAll('ö', 'oe')
              .replaceAll('ü', 'ue')
              .replaceAll('ß', 'ss')
              .replaceAll(' ', '_')
              .replaceAll(/[\W]+/g,"")
              .replaceAll('_', this.$store.state.config.groupIdDelimiter)
              .substr(0,20);
      }
    },
    getData: function () {
      return axios.get('/api/users')
        .then(response => {
          this.users = response.data.users;
          return axios.get('api/groups')
            .then(response => {
              this.groups = response.data.groups;
              this.loaded = true;
            })
        })
        .catch(e => {})
    }
  },
  async created() {
    this.oldGroup = {... this.group};
    if (this.action === 'openGroup') {
      this.users = this.group.member;
      this.groups = [this.group]
      this.loaded = true;
    } else {
      await this.getData();
    }
  }
}
</script>