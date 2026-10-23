'use client'

import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Badge } from './badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card'
import { Input } from './input'
import { Label } from './label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'
import { Text } from './text'

const meta = {
  title: 'Navigation/Tabs',
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue='account' className='w-full max-w-md'>
      <TabsList>
        <TabsTrigger value='account'>Account</TabsTrigger>
        <TabsTrigger value='password'>Password</TabsTrigger>
      </TabsList>
      <TabsContent value='account'>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Make changes to your account here.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='name'>Name</Label>
              <Input id='name' defaultValue='Thomas' />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value='password'>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Change your password here.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='space-y-1'>
              <Label htmlFor='current'>Current password</Label>
              <Input id='current' type='password' />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue='overview' className='w-full max-w-md'>
      <TabsList variant='line'>
        <TabsTrigger value='overview'>Overview</TabsTrigger>
        <TabsTrigger value='analytics'>Analytics</TabsTrigger>
        <TabsTrigger value='reports'>Reports</TabsTrigger>
        <TabsTrigger value='notifications' disabled>
          Notifications
        </TabsTrigger>
      </TabsList>
      <TabsContent value='overview'>
        <Text size='sm' className='pt-4'>
          Overview of your dropshipping operations.
        </Text>
      </TabsContent>
      <TabsContent value='analytics'>
        <Text size='sm' className='pt-4'>
          Analytics and performance metrics.
        </Text>
      </TabsContent>
      <TabsContent value='reports'>
        <Text size='sm' className='pt-4'>
          Generated reports and exports.
        </Text>
      </TabsContent>
    </Tabs>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState('orders')

    return (
      <div>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='w-full max-w-md'>
          <TabsList variant='line'>
            <TabsTrigger value='orders'>Orders</TabsTrigger>
            <TabsTrigger value='shipments'>Shipments</TabsTrigger>
            <TabsTrigger value='returns'>Returns</TabsTrigger>
          </TabsList>
          <TabsContent value='orders'>
            <Text size='sm' className='pt-4'>
              Manage your active orders.
            </Text>
          </TabsContent>
          <TabsContent value='shipments'>
            <Text size='sm' className='pt-4'>
              Track outgoing shipments.
            </Text>
          </TabsContent>
          <TabsContent value='returns'>
            <Text size='sm' className='pt-4'>
              Process customer returns.
            </Text>
          </TabsContent>
        </Tabs>
        <Text size='xs' variant='muted' className='mt-2'>
          Active tab: <Badge variant='secondary'>{activeTab}</Badge>
        </Text>
      </div>
    )
  },
}

export const Vertical: Story = {
  render: () => (
    <Tabs
      defaultValue='general'
      orientation='vertical'
      className='w-full max-w-lg'>
      <TabsList variant='line'>
        <TabsTrigger value='general'>General</TabsTrigger>
        <TabsTrigger value='security'>Security</TabsTrigger>
        <TabsTrigger value='notifications'>Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value='general'>
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Text size='sm'>Configure your general preferences.</Text>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value='security'>
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Text size='sm'>Manage your account security.</Text>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value='notifications'>
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <Text size='sm'>Control how you receive notifications.</Text>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
}
